import { type VerifiedSp, verifyDocuments } from "@originator-profile/verify";
import { getRegistry } from "../../utils/registry-ops";
import { fetchTabCredentials, FrameIntegrityVerifier } from "../credentials";
import { deduplicateCas } from "../credentials/deduplicate-cas";
import type { SupportedCa, SupportedVerifiedCas } from "../credentials/types";
import {
  isSiteProfileFetchError,
  verifyTabWebsite,
} from "../siteProfile/verify-website";

/**
 * Web サイトを取得して検証する
 * @param tabId タブID
 * @returns 検証済み Site Profile、または取得・検証失敗時はnull
 */
async function fetchVerifiedWebsite(tabId: number): Promise<VerifiedSp | null> {
  try {
    return await verifyTabWebsite(tabId);
  } catch (error) {
    // NOTE: Site Profile 未設置は異常ではないため通知しない
    if (!isSiteProfileFetchError(error)) {
      console.error(
        `[fetchVerifiedWebsite] Failed to verify website for tab ${tabId}:`,
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
    const [website, { frames, ...page }, registry] = await Promise.all([
      fetchVerifiedWebsite(tabId),
      fetchTabCredentials(tabId),
      getRegistry(),
    ]);

    const targets = [page, ...frames].map((frame) => ({
      ...frame,
      verifyIntegrity: FrameIntegrityVerifier(tabId, frame.frameId),
    }));

    const result = await verifyDocuments<SupportedCa, (typeof targets)[number]>(
      targets,
      { registry, website },
    );

    if (result instanceof Error) return null;

    const verifiedCas = deduplicateCas(
      result.documents.flatMap(({ cas }) => cas),
    );
    return { verifiedCas, count: verifiedCas.length };
  } catch (error) {
    console.error(
      `[verifyTabCredentials] Failed to verify credentials for tab ${tabId}:`,
      error,
    );
    return null;
  }
}
