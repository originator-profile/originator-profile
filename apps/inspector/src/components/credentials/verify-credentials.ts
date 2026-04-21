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
import { getRegistryKeys } from "../../utils/get-registry-keys";
import { FrameIntegrityVerifier } from "./messaging";
import type { SupportedCa, SupportedVerifiedCas } from "./types";

/**
 * OPSを検証する。
 * REGISTRY_OPSとページ・フレームのOPSを結合して検証し、
 * Site Profile由来のOriginatorsを追加する。
 */
export async function verifyOps(
  page: { ops: Parameters<typeof OpsVerifier>[0] },
  frames: { ops: Parameters<typeof OpsVerifier>[0] }[],
  siteProfile?: VerifiedSp | null,
): ReturnType<ReturnType<typeof OpsVerifier>> {
  const [issuer, keys] = getRegistryKeys();
  const opsVerifier = OpsVerifier(
    [
      ...import.meta.env.REGISTRY_OPS,
      ...page.ops,
      ...frames.flatMap((frame) => frame.ops),
    ],
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
