import type {
  ContentAttestationSet,
  OriginatorProfileSet,
} from "@originator-profile/model";
import {
  CasVerifyFailed,
  type Logger,
  OpsInvalid,
  OpsVerifier,
  OpsVerifyFailed,
  type Registry,
  type VerifiedOps,
  type VerifiedSp,
  type VerifyIntegrity,
  verifyCas,
} from "@originator-profile/verify";
import { createCollectingLogger } from "../../utils/collecting-logger";
import { deduplicateCas } from "./deduplicate-cas";
import type {
  FrameCredentials,
  SupportedCa,
  SupportedVerifiedCas,
  TabCredentials,
} from "./types";

/** フレームの Target Integrity 検証器を作成する */
export type CreateIntegrityVerifier = (frame: {
  frameId: number;
}) => VerifyIntegrity;

/** クレデンシャル検証に必要な外部境界 */
export type VerifyCredentialsContext = {
  registry: Registry;
  createIntegrityVerifier: CreateIntegrityVerifier;
  siteProfile?: VerifiedSp | null;
};

/**
 * OPSを検証する。
 * REGISTRY_OPSとページ・フレームのOPSを結合して検証し、
 * Site Profile由来のOriginatorsを追加する。
 */
export async function verifyOps(
  page: { ops: OriginatorProfileSet },
  frames: { ops: OriginatorProfileSet }[],
  options: {
    registry: Registry;
    siteProfile?: VerifiedSp | null;
    logger?: Logger;
  },
): ReturnType<ReturnType<typeof OpsVerifier>> {
  const { registry, siteProfile, logger } = options;

  const opsVerifier = OpsVerifier(
    [...registry.ops, ...page.ops, ...frames.flatMap((frame) => frame.ops)],
    registry.keys,
    registry.issuer,
    { logger },
  );
  const verifiedOps = await opsVerifier();

  if (
    verifiedOps instanceof OpsInvalid ||
    verifiedOps instanceof OpsVerifyFailed
  ) {
    return verifiedOps;
  }

  const siteOriginators = siteProfile?.originators ?? [];
  verifiedOps.push(...siteOriginators);

  return verifiedOps;
}

type FrameCasInput = {
  cas: ContentAttestationSet;
  url: string;
  frameId: number;
};

/**
 * フレームごとにCASを検証する。
 * 各フレームの検証結果とフレーム情報をペアで返す。
 */
export async function verifyFramesCas<F extends FrameCasInput>(
  frames: F[],
  verifiedOps: VerifiedOps,
  createIntegrityVerifier: CreateIntegrityVerifier,
): Promise<{ result: SupportedVerifiedCas | CasVerifyFailed; frame: F }[]> {
  return Promise.all(
    frames.map((frame) =>
      verifyCas<SupportedCa>(
        frame.cas,
        verifiedOps,
        frame.url,
        createIntegrityVerifier(frame),
      ).then((result) => ({ result, frame })),
    ),
  );
}

/**
 * タブ内のクレデンシャルを検証する共通関数
 * @param page ページ
 * @param frames フレームのリスト
 * @param context レジストリ・Target Integrity 検証器・Site Profile
 * @returns
 *    - 成功時: { ops, cas, casResults, warnings, info }
 *    - 失敗時: 検証失敗した結果
 */
export async function verifyAllCredentials(
  page: Omit<TabCredentials, "frames">,
  frames: FrameCredentials[],
  context: VerifyCredentialsContext,
) {
  const { registry, createIntegrityVerifier, siteProfile } = context;
  const { logger, warnings, info } = createCollectingLogger();

  // OPS 検証
  const verifiedOps = await verifyOps(page, frames, {
    registry,
    siteProfile,
    logger,
  });
  if (
    verifiedOps instanceof OpsInvalid ||
    verifiedOps instanceof OpsVerifyFailed
  ) {
    return verifiedOps;
  }

  // CAS 検証
  const casResults = await verifyFramesCas(
    [page, ...frames],
    verifiedOps,
    createIntegrityVerifier,
  );
  const failedCas = casResults.find(
    ({ result }) => result instanceof CasVerifyFailed,
  );
  if (failedCas) {
    return failedCas.result as CasVerifyFailed;
  }

  return {
    ops: verifiedOps,
    cas: deduplicateCas(
      casResults.flatMap(({ result }) => result as SupportedVerifiedCas),
    ),
    casResults,
    warnings,
    info,
  };
}
