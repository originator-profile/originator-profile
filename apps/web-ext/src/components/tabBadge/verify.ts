import { deserializeIfError } from "@originator-profile/core";
import type { ContentAttestationSet } from "@originator-profile/model";
import {
  CasVerifyFailed,
  OpsInvalid,
  OpsVerifier,
  OpsVerifyFailed,
  SpVerifier,
  VerifiedSp,
  verifyCas,
} from "@originator-profile/verify";
import { getRegistryKeys } from "../../utils/get-registry-keys";
import {
  fetchTabCredentials,
  FrameIntegrityVerifier,
} from "../credentials/messaging";
import type { SupportedCa, SupportedVerifiedCas } from "../credentials/types";
import { siteProfileMessenger } from "../siteProfile/events";

/**
 * Site Profileを取得して検証する
 * @param tabId タブID
 * @returns 検証済みSite Profile、または取得・検証失敗時はnull
 */
async function fetchVerifiedSiteProfile(
  tabId: number,
): Promise<VerifiedSp | null> {
  try {
    const result = await siteProfileMessenger.sendMessage(
      "fetchSiteProfile",
      null,
      tabId,
    );
    const parsed = deserializeIfError(result);

    if (parsed instanceof Error) {
      return null;
    }

    const [issuer, keys] = getRegistryKeys();
    const verifySp = SpVerifier(
      {
        ...parsed.result,
        originators: [
          ...import.meta.env.REGISTRY_OPS,
          ...parsed.result.originators,
        ],
      },
      keys,
      issuer,
      parsed.origin,
    );

    const verifiedSp = await verifySp();
    if (verifiedSp instanceof Error) {
      return null;
    }
    return verifiedSp;
  } catch (error) {
    console.error(
      `[fetchVerifiedSiteProfile] Failed to fetch site profile for tab ${tabId}:`,
      error,
    );
    return null;
  }
}

/**
 * OPSを検証する
 * @param page ページのクレデンシャル
 * @param frames フレームのクレデンシャル
 * @param siteOps Site Profileから取得したOriginators
 * @returns 検証済みOPS配列、または検証失敗時はnull
 */
async function verifyOps(
  page: { ops: Parameters<typeof OpsVerifier>[0] },
  frames: { ops: Parameters<typeof OpsVerifier>[0] }[],
  siteOps: Awaited<ReturnType<typeof fetchVerifiedSiteProfile>>,
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

  // Site ProfileのOriginatorsを追加
  const verifiedSiteOps = siteOps?.originators ?? [];
  verifiedOps.push(...verifiedSiteOps);

  return verifiedOps;
}

/**
 * 全フレームのCASを検証し、重複を排除して集約する
 * @param tabId タブID
 * @param frameData ページおよびフレームのクレデンシャル
 * @param verifiedOps 検証済みOPS
 * @returns 検証済みCAS配列、または検証失敗時はnull
 */
async function verifyAllCas(
  tabId: number,
  frameData: { cas: ContentAttestationSet; url: string; frameId: number }[],
  verifiedOps: Exclude<
    Awaited<ReturnType<ReturnType<typeof OpsVerifier>>>,
    OpsInvalid | OpsVerifyFailed
  >,
): Promise<SupportedVerifiedCas | null> {
  const verifiedCasResults = await Promise.all(
    frameData.map(({ cas, url, frameId }) =>
      verifyCas<SupportedCa>(
        cas,
        verifiedOps,
        url,
        FrameIntegrityVerifier(tabId, frameId),
      ),
    ),
  );

  const hasVerifyFailed = verifiedCasResults.some(
    (result) => result instanceof CasVerifyFailed,
  );
  if (hasVerifyFailed) {
    return null;
  }

  // 重複を除いて全CASを集約（IDで重複排除）
  // 上記でCasVerifyFailedはフィルタリング済みのため、型アサーションは安全
  return Array.from(
    new Map(
      (verifiedCasResults as SupportedVerifiedCas[]).flatMap((result) =>
        result.map(
          (ca) => [ca.attestation.doc.credentialSubject.id, ca] as const,
        ),
      ),
    ).values(),
  );
}

/**
 * タブのクレデンシャルを検証する
 * @param tabId タブID
 * @returns 検証成功時は検証済みCASとその件数。OPS検証失敗時、CAS検証失敗時、
 *          または検証処理中にエラーが発生した場合はnull
 */
export async function verifyTabCredentials(tabId: number): Promise<{
  verifiedCas: SupportedVerifiedCas;
  count: number;
} | null> {
  try {
    // Site ProfileとCredentialsを並行取得
    const [siteProfile, { frames, ...page }] = await Promise.all([
      fetchVerifiedSiteProfile(tabId),
      fetchTabCredentials(tabId),
    ]);

    // OPS 検証
    const verifiedOps = await verifyOps(page, frames, siteProfile);
    if (
      verifiedOps instanceof OpsInvalid ||
      verifiedOps instanceof OpsVerifyFailed
    ) {
      return null;
    }

    // CAS 検証
    const allVerifiedCas = await verifyAllCas(
      tabId,
      [page, ...frames],
      verifiedOps,
    );
    if (allVerifiedCas === null) {
      return null;
    }

    return {
      verifiedCas: allVerifiedCas,
      count: allVerifiedCas.length,
    };
  } catch (error) {
    console.error(
      `[verifyTabCredentials] Failed to verify credentials for tab ${tabId}:`,
      error,
    );
    return null;
  }
}
