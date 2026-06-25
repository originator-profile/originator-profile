import type { ContentAttestationSet } from "@originator-profile/model";
import {
  CasVerifyFailed,
  OpsInvalid,
  OpsVerifier,
  OpsVerifyFailed,
  type VerifiedOps,
  type VerifiedSp,
  verifyCas,
} from "@originator-profile/verify";
import { getCpIssuerKeys, getCpIssuerOps } from "../../utils/cp-issuer-ops";
import { deduplicateCas } from "./deduplicate-cas";
import { FrameIntegrityVerifier } from "./messaging";
import type {
  FrameCredentials,
  SupportedCa,
  SupportedVerifiedCas,
  TabCredentials,
} from "./types";

/**
 * OPSを検証する。
 * CP_ISSUER_OPSとページ・フレームのOPSを結合して検証し、
 * Site Profile由来のOriginatorsを追加する。
 */
export async function verifyOps(
  page: { ops: Parameters<typeof OpsVerifier>[0] },
  frames: { ops: Parameters<typeof OpsVerifier>[0] }[],
  siteProfile?: VerifiedSp | null,
): ReturnType<ReturnType<typeof OpsVerifier>> {
  const [[issuer, keys], cpIssuerOps] = await Promise.all([
    getCpIssuerKeys(),
    getCpIssuerOps(),
  ]);
  const opsVerifier = OpsVerifier(
    [...cpIssuerOps, ...page.ops, ...frames.flatMap((frame) => frame.ops)],
    keys,
    issuer,
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
  tabId: number,
  frames: F[],
  verifiedOps: VerifiedOps,
): Promise<{ result: SupportedVerifiedCas | CasVerifyFailed; frame: F }[]> {
  return Promise.all(
    frames.map((frame) =>
      verifyCas<SupportedCa>(
        frame.cas,
        verifiedOps,
        frame.url,
        FrameIntegrityVerifier(tabId, frame.frameId),
      ).then((result) => ({ result, frame })),
    ),
  );
}

/**
 * タブ内のクレデンシャルを検証する共通関数
 * @param tabId タブID
 * @param page ページ
 * @param frames フレームのリスト
 * @param siteProfile Site Profile
 * @returns
 *    - 成功時: { ops, cas, casResults }
 *    - 失敗時: 検証失敗した結果
 */
export async function verifyAllCredentials(
  tabId: number,
  page: Omit<TabCredentials, "frames">,
  frames: FrameCredentials[],
  siteProfile?: VerifiedSp | null,
) {
  // OPS 検証
  const verifiedOps = await verifyOps(page, frames, siteProfile);
  if (
    verifiedOps instanceof OpsInvalid ||
    verifiedOps instanceof OpsVerifyFailed
  ) {
    return verifiedOps;
  }

  // CAS 検証
  const casResults = await verifyFramesCas(
    tabId,
    [page, ...frames],
    verifiedOps,
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
  };
}
