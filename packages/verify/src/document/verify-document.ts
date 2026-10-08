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

/** 文書が置かれているフレームの種類 */
export type FrameType = "outermost_frame" | "sub_frame" | "fenced_frame";

/** 検証対象の文書 */
export type VerificationTarget = {
  /** 文書に設置された Originator Profile Set */
  ops: OriginatorProfileSet;
  /** 文書に設置された Content Attestation Set */
  cas: ContentAttestationSet;
  /** 文書の URL */
  url: string;
  /** 文書が置かれているフレームの種類 */
  frameType: FrameType;
  /** 文書内の Target Integrity 検証器 */
  verifyIntegrity: VerifyIntegrity;
};

/** 文書の検証結果に含まれる復号ペイロード */
export type DocumentOutcome<Target extends VerificationTarget> = {
  /** 検証対象の文書 */
  target: Target;
  /** 発信者ごとの復号ペイロード */
  originators: OriginatorPayload[];
  /** Content Attestation の復号ペイロード */
  cas: CasPayload[];
};

/**
 * 文書の検証
 *
 * レジストリとその文書に設置された Originator Profile Set を検証し、その結果を
 * 用いて文書の Content Attestation Set を検証する。他の文書に設置された OPS は
 * 用いない。
 *
 * @param target 検証対象の文書
 * @param options レジストリ・Site Profile の発信者・バリデーター・ロガー
 * @returns 検証結果。復号できたペイロードは status によらず outcome に含まれる
 *
 * @example
 * ```ts
 * const result = await verifyDocument(target, { registry });
 * result.outcome?.cas; // Content Attestation の復号ペイロード
 * if (!result.status) result.errors; // 検証失敗の理由
 * ```
 */
export async function verifyDocument<
  Target extends VerificationTarget = VerificationTarget,
>(
  target: Target,
  options: {
    /** Core Profile 発行者のレジストリ */
    registry: Registry;
    /**
     * トップレベル文書のオリジンの Site Profile が提示する発信者。
     * 文書がトップレベル文書のときに限り、文書の OPS と併せて検証し検証鍵に加える
     */
    siteOriginators?: OriginatorProfileSet;
    /** バリデーター */
    validator?: VcValidatorFactory;
    /** ロガー (デフォルト: `console`) */
    logger?: Logger;
  },
): Promise<VerificationResult<DocumentOutcome<Target>>> {
  const { registry, siteOriginators, validator, logger } = options;
  const { logger: collecting, warnings, info } = collectProblems(logger);
  const collect = createCollector();

  // NOTE: サブフレーム中のコンテンツの検証にトップレベル文書の SP を用いてはならない
  // see https://docs.originator-profile.org/ja/opb/verifier-processing-model/site-profile/
  const isTopLevel = target.frameType === "outermost_frame";
  const opsVerifier = OpsVerifier(
    [
      ...registry.ops,
      ...(isTopLevel ? (siteOriginators ?? []) : []),
      ...target.ops,
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
      outcome: {
        target,
        originators: convertOps(verifiedOps, collect),
        cas: [],
      },
      securingResults: collect.securingResults,
      warnings,
      info,
      errors: [toProblemDetails(verifiedOps), ...collect.errors],
    };
  }

  const cas = await verifyCas(
    target.cas,
    verifiedOps,
    target.url,
    target.verifyIntegrity,
    validator,
    collecting,
    pointer(),
  );

  const outcome: DocumentOutcome<Target> = {
    target,
    originators: convertOps(verifiedOps, collect),
    cas: convertCas(
      cas instanceof CasVerifyFailed ? cas.result : cas,
      pointer(),
      collect,
    ),
  };

  return cas instanceof CasVerifyFailed
    ? {
        status: false,
        outcome,
        securingResults: collect.securingResults,
        warnings,
        info,
        errors: [toProblemDetails(cas, pointer("cas")), ...collect.errors],
      }
    : {
        status: true,
        outcome,
        securingResults: collect.securingResults,
        warnings,
        info,
      };
}
