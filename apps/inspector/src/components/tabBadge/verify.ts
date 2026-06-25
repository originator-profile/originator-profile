import { deserializeIfError } from "@originator-profile/core";
import {
  CasVerifyFailed,
  OpsInvalid,
  OpsVerifyFailed,
  SpVerifier,
  VerifiedSp,
} from "@originator-profile/verify";
import { getRegistryOps } from "../../utils/registry-ops";
import { deduplicateCas } from "../credentials/deduplicate-cas";
import { fetchTabCredentials } from "../credentials/messaging";
import type { SupportedVerifiedCas } from "../credentials/types";
import { verifyFramesCas, verifyOps } from "../credentials/verify-credentials";
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

    const {
      ops: registryOps,
      keys: [cpIssuer, verificationKeys],
    } = await getRegistryOps();

    const verifySp = SpVerifier(
      {
        ...parsed.result,
        originators: [...registryOps, ...parsed.result.originators],
      },
      verificationKeys,
      cpIssuer,
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
    const casResults = await verifyFramesCas(
      tabId,
      [page, ...frames],
      verifiedOps,
    );
    if (casResults.some(({ result }) => result instanceof CasVerifyFailed)) {
      return null;
    }

    const allVerifiedCas = deduplicateCas(
      casResults.flatMap(({ result }) => result as SupportedVerifiedCas),
    );

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
