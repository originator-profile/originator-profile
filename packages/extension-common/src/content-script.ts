import { serializeIfError } from "@originator-profile/core";
import { fetchSiteProfile } from "@originator-profile/presentation";
import { verifyIntegrity } from "@originator-profile/verify";
import { credentialsMessenger } from "./credentials/events";
import { siteProfileMessenger } from "./site-profile/events";
import {
  fetchDocumentCredentials,
  setupDocumentVerification,
} from "./verification/content-script";

export { setupAdClickDetection } from "./link-verification/detect-ad-click";
export { setupOnce } from "./setup-once";

/**
 * 全フレームで登録するハンドラ
 *
 * 文書の検証、クレデンシャルの取得、Target Integrity の検証をおこなう。
 */
export function setupFrameHandlers() {
  setupDocumentVerification();

  credentialsMessenger.onMessage("fetchCredentials", fetchDocumentCredentials);

  credentialsMessenger.onMessage(
    "verifyIntegrity",
    async ({ data: content }) => {
      const result = await verifyIntegrity(content);
      return serializeIfError(result);
    },
  );
}

/**
 * 最上位フレームで登録するハンドラ
 *
 * Site Profile の取得をおこなう。
 */
export function setupTopFrameHandlers() {
  siteProfileMessenger.onMessage("fetchSiteProfile", async () => {
    const data = await fetchSiteProfile(document);
    return serializeIfError(data);
  });
}
