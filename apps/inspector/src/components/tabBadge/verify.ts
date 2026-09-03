import type { VerifiedSp } from "@originator-profile/verify";
import { fetchTabCredentials } from "../credentials";
import type { SupportedVerifiedCas } from "../credentials/types";
import { verifyAllCredentials } from "../credentials/verify-credentials";
import {
  isSiteProfileFetchError,
  verifyTabSiteProfile,
} from "../siteProfile/verify-site-profile";

/**
 * Site Profileを取得して検証する
 * @param tabId タブID
 * @returns 検証済みSite Profile、または取得・検証失敗時はnull
 */
async function fetchVerifiedSiteProfile(
  tabId: number,
): Promise<VerifiedSp | null> {
  try {
    return await verifyTabSiteProfile(tabId);
  } catch (error) {
    // NOTE: Site Profile 未設置は異常ではないため通知しない
    if (!isSiteProfileFetchError(error)) {
      console.error(
        `[fetchVerifiedSiteProfile] Failed to verify site profile for tab ${tabId}:`,
        error,
      );
    }
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
    const [siteProfile, { frames, ...page }] = await Promise.all([
      fetchVerifiedSiteProfile(tabId),
      fetchTabCredentials(tabId),
    ]);
    const result = await verifyAllCredentials(tabId, page, frames, siteProfile);

    if (result instanceof Error) return null;

    return {
      verifiedCas: result.cas,
      count: result.cas.length,
    };
  } catch (error) {
    console.error(
      `[verifyTabCredentials] Failed to verify credentials for tab ${tabId}:`,
      error,
    );
    return null;
  }
}
