import { deserializeIfError } from "@originator-profile/core";
import {
  CasVerifyFailed,
  OpsInvalid,
  OpsVerifier,
  OpsVerifyFailed,
  SpVerifier,
  verifyCas,
  VerifiedSp,
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
  } catch {
    // Site Profileが存在しない場合はnullを返す
    return null;
  }
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

    // Site ProfileからverifiedSiteOpsを取得
    const verifiedSiteOps = siteProfile?.originators ?? [];

    // OPS 検証（全フレームのOPSを含む）
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
      // OPS 検証失敗
      return null;
    }

    // Site ProfileのOriginatorsを追加
    verifiedOps.push(...verifiedSiteOps);

    // CAS 検証（全フレームのCASを検証）
    const verifiedCasResults = await Promise.all(
      [page, ...frames].map(({ cas, url, frameId }) =>
        verifyCas<SupportedCa>(
          cas,
          verifiedOps,
          url,
          FrameIntegrityVerifier(tabId, frameId),
        ),
      ),
    );

    // 検証失敗があれば null を返す
    for (const result of verifiedCasResults) {
      if (result instanceof CasVerifyFailed) {
        return null;
      }
    }

    // 重複を除いて全CASを集約（IDで重複排除）
    const allVerifiedCas = Array.from(
      new Map(
        verifiedCasResults.flatMap((result) =>
          (result as SupportedVerifiedCas).map((ca) => [
            ca.attestation.doc.credentialSubject.id,
            ca,
          ]),
        ),
      ).values(),
    );

    return {
      verifiedCas: allVerifiedCas,
      count: allVerifiedCas.length,
    };
  } catch (error) {
    console.error(`Failed to verify credentials for tab ${tabId}:`, error);
    return null;
  }
}
