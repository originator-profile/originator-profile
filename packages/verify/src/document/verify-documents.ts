import type {
  ContentAttestation,
  ContentAttestationSet,
  OriginatorProfileSet,
} from "@originator-profile/model";
import type { VcValidator } from "@originator-profile/securing-mechanism";
import {
  CasVerifyFailed,
  verifyCas,
  type VerifiedCas,
} from "../content-attestation-set";
import type { VerifyIntegrity } from "../integrity";
import type { Logger } from "../logger";
import {
  OpsInvalid,
  OpsVerifier,
  OpsVerifyFailed,
  type VerifiedOps,
} from "../originator-profile-set";
import type { Registry } from "../registry";
import type { VerifiedSp } from "../site-profile";

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

/** 検証済みの文書 */
export type VerifiedDocument<
  Ca extends ContentAttestation,
  Target extends VerificationTarget,
> = {
  target: Target;
  cas: VerifiedCas<Ca>;
};

/** 検証済みの文書群 */
export type VerifiedDocuments<
  Ca extends ContentAttestation,
  Target extends VerificationTarget,
> = {
  /** 検証済みの発信者 */
  originators: VerifiedOps;
  /** 文書ごとの検証結果 */
  documents: VerifiedDocument<Ca, Target>[];
};

/**
 * 文書群の検証
 *
 * レジストリと各文書の Originator Profile Set を結合して検証し、その結果を
 * 用いて文書ごとに Content Attestation Set を検証する。
 *
 * @param targets 検証対象の文書
 * @param options レジストリ・検証済み Web サイト・バリデーター・ロガー
 * @returns 文書ごとの検証結果、または検証に失敗した結果
 *
 * @example
 * ```ts
 * const result = await verifyDocuments(targets, { registry, website });
 * if (result instanceof Error) return result;
 * result.documents; // [{ target, cas }, ...]
 * ```
 */
export async function verifyDocuments<
  Ca extends ContentAttestation = ContentAttestation,
  Target extends VerificationTarget = VerificationTarget,
>(
  targets: Target[],
  options: {
    /** Core Profile 発行者のレジストリ */
    registry: Registry;
    /** 検証済みの Web サイト。その発信者を検証済み OPS に加える */
    website?: VerifiedSp | null;
    /** バリデーター */
    validator?: typeof VcValidator;
    /** ロガー (デフォルト: `console`) */
    logger?: Logger;
  },
): Promise<
  VerifiedDocuments<Ca, Target> | OpsInvalid | OpsVerifyFailed | CasVerifyFailed
> {
  const { registry, website, validator, logger } = options;

  const opsVerifier = OpsVerifier(
    [...registry.ops, ...targets.flatMap((target) => target.ops)],
    registry.keys,
    registry.issuer,
    { validator, logger },
  );
  const verifiedOps = await opsVerifier();
  if (
    verifiedOps instanceof OpsInvalid ||
    verifiedOps instanceof OpsVerifyFailed
  ) {
    return verifiedOps;
  }

  const originators: VerifiedOps = [
    ...verifiedOps,
    ...(website?.originators ?? []),
  ];

  const results = await Promise.all(
    targets.map(async (target) => ({
      target,
      cas: await verifyCas<Ca>(
        target.cas,
        originators,
        target.url,
        target.verifyIntegrity,
        validator,
      ),
    })),
  );

  const failed = results.find(({ cas }) => cas instanceof CasVerifyFailed);
  if (failed) {
    return failed.cas as CasVerifyFailed;
  }

  return {
    originators,
    documents: results as VerifiedDocument<Ca, Target>[],
  };
}
