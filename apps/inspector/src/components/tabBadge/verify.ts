import {
  FrameIntegrityVerifier,
  type SupportedVerifiedCas,
  deduplicateCas,
  fetchTabCredentials,
  getRegistry,
  isSiteProfileFetchError,
  verifyTabWebsite,
} from "@originator-profile/extension-common";
import type { OriginatorProfileSet } from "@originator-profile/model";
import { verifyDocuments } from "@originator-profile/verify";
import { toLegacyDocuments } from "../../utils/to-legacy-result";

/**
 * Web サイトを検証し、文書の検証で検証鍵に加える発信者を得る
 * @param tabId タブID
 * @returns サイトが提示した発信者。取得・検証に失敗した場合は undefined
 */
async function fetchWebsiteOriginators(
  tabId: number,
): Promise<OriginatorProfileSet | undefined> {
  try {
    const { result, siteProfile } = await verifyTabWebsite(tabId);
    if (result.status) return siteProfile?.originators;

    // NOTE: Site Profile 未設置は異常ではないため通知しない
    if (!isSiteProfileFetchError(result.errors[0])) {
      console.error(
        `[fetchWebsiteOriginators] Failed to verify website for tab ${tabId}:`,
        result.errors,
      );
    }
    return undefined;
  } catch (error) {
    console.error(
      `[fetchWebsiteOriginators] Failed to verify website for tab ${tabId}:`,
      error,
    );
    return undefined;
  }
}

/**
 * タブのクレデンシャルを検証する
 * @param tabId タブID
 * @returns 検証成功時は検証済みCASとその件数。検証に失敗した場合、
 *          または検証処理中にエラーが発生した場合はnull
 */
export async function verifyTabCredentials(tabId: number): Promise<{
  verifiedCas: SupportedVerifiedCas;
  count: number;
} | null> {
  try {
    const [websiteOriginators, { frames, ...page }, registry] =
      await Promise.all([
        fetchWebsiteOriginators(tabId),
        fetchTabCredentials(tabId),
        getRegistry(),
      ]);

    const targets = [page, ...frames].map((frame) => ({
      ...frame,
      ops: frame.ops.map(({ credential }) => credential),
      cas: frame.cas.map(({ credential }) => credential),
      verifyIntegrity: FrameIntegrityVerifier(tabId, frame.frameId),
    }));

    const result = await verifyDocuments(targets, {
      registry,
      websiteOriginators,
    });

    const legacy = toLegacyDocuments(result);
    if (legacy instanceof Error) return null;

    const verifiedCas = deduplicateCas(
      legacy.documents.flatMap(({ cas }) => cas),
    ) as SupportedVerifiedCas;
    return { verifiedCas, count: verifiedCas.length };
  } catch (error) {
    console.error(
      `[verifyTabCredentials] Failed to verify credentials for tab ${tabId}:`,
      error,
    );
    return null;
  }
}
