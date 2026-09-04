import type {
  ContentAttestationSet,
  OriginatorProfileSet,
} from "@originator-profile/model";
import type { VcValidatorFactory } from "@originator-profile/securing-mechanism";
import { CasVerifyFailed, verifyCas } from "../content-attestation-set";
import type { VerifyIntegrity } from "../integrity";
import type { Logger } from "../logger";
import {
  OpsInvalid,
  OpsVerifier,
  OpsVerifyFailed,
} from "../originator-profile-set";
import type { Registry } from "../registry";
import { collectProblems } from "../result/collect-problems";
import {
  convertCas,
  convertOps,
  createCollector,
  type CasPayload,
  type OriginatorPayload,
} from "../result/convert";
import { pointer } from "../result/pointer";
import { toProblemDetails } from "../result/to-problem-details";
import type { VerificationResult } from "../result/types";

/** 検証対象の文書 */
export type VerificationTarget = {
  /** 文書に設置された Originator Profile Set */
  ops: OriginatorProfileSet;
  /** 文書に設置された Content Attestation Set */
  cas: ContentAttestationSet;
  /** 文書の URL */
  url: string;
  /** 文書内の Target Integrity 検証器 */
  verifyIntegrity: VerifyIntegrity;
};

/** 文書ごとの復号ペイロード */
export type DocumentOutcome<Target extends VerificationTarget> = {
  /** 検証対象の文書 */
  target: Target;
  /** Content Attestation の復号ペイロード */
  cas: CasPayload[];
};

/** 文書群の検証結果に含まれる復号ペイロード */
export type DocumentsOutcome<Target extends VerificationTarget> = {
  /** 発信者ごとの復号ペイロード */
  originators: OriginatorPayload[];
  /** 文書ごとの復号ペイロード */
  documents: DocumentOutcome<Target>[];
};

/** Content Attestation Set の検証結果が持つ形 */
type CasLike = { main: boolean; attestation: unknown }[];

/**
 * 文書群の検証
 *
 * レジストリ・Web サイト・各文書の Originator Profile Set を結合して検証し、
 * その結果を用いて文書ごとに Content Attestation Set を検証する。
 *
 * @param targets 検証対象の文書
 * @param options レジストリ・Web サイトの発信者・バリデーター・ロガー
 * @returns 検証結果。復号できたペイロードは status によらず outcome に含まれる
 *
 * @example
 * ```ts
 * const result = await verifyDocuments(targets, { registry });
 * result.outcome?.documents; // 文書ごとの Content Attestation の復号ペイロード
 * if (!result.status) result.errors; // 検証失敗の理由
 * ```
 */
export async function verifyDocuments<
  Target extends VerificationTarget = VerificationTarget,
>(
  targets: Target[],
  options: {
    /** Core Profile 発行者のレジストリ */
    registry: Registry;
    /** Web サイトが提示する発信者。文書の OPS と併せて検証し、検証鍵に加える */
    websiteOriginators?: OriginatorProfileSet;
    /** バリデーター */
    validator?: VcValidatorFactory;
    /** ロガー (デフォルト: `console`) */
    logger?: Logger;
  },
): Promise<VerificationResult<DocumentsOutcome<Target>>> {
  const { registry, websiteOriginators, validator, logger } = options;
  const { logger: collecting, warnings, info } = collectProblems(logger);
  const collect = createCollector();

  const opsVerifier = OpsVerifier(
    [
      ...registry.ops,
      ...(websiteOriginators ?? []),
      ...targets.flatMap((target) => target.ops),
    ],
    registry.keys,
    registry.issuer,
    { validator, logger: collecting },
  );
  const verifiedOps = await opsVerifier();

  if (
    verifiedOps instanceof OpsInvalid ||
    verifiedOps instanceof OpsVerifyFailed
  ) {
    return {
      status: false,
      outcome: { originators: convertOps(verifiedOps, collect), documents: [] },
      securingResults: collect.securingResults,
      warnings,
      info,
      errors: [toProblemDetails(verifiedOps), ...collect.errors],
    };
  }

  const results = await Promise.all(
    targets.map(async (target, index) => {
      const at = pointer("documents", index);
      return {
        target,
        at,
        cas: await verifyCas(
          target.cas,
          verifiedOps,
          target.url,
          target.verifyIntegrity,
          validator,
          collecting,
          at,
        ),
      };
    }),
  );

  const outcome: DocumentsOutcome<Target> = {
    originators: convertOps(verifiedOps, collect),
    documents: results.map(({ target, at, cas }) => ({
      target,
      cas: convertCas(
        (cas instanceof CasVerifyFailed ? cas.result : cas) as CasLike,
        at,
        collect,
      ),
    })),
  };

  const failed = results.find(({ cas }) => cas instanceof CasVerifyFailed);

  return failed
    ? {
        status: false,
        outcome,
        securingResults: collect.securingResults,
        warnings,
        info,
        errors: [toProblemDetails(failed.cas, failed.at), ...collect.errors],
      }
    : {
        status: true,
        outcome,
        securingResults: collect.securingResults,
        warnings,
        info,
        errors: collect.errors,
      };
}
