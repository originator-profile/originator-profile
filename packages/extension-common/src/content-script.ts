import { serializeIfError } from "@originator-profile/core";
import { fetchSiteProfile } from "@originator-profile/presentation";
import { verifyIntegrity } from "@originator-profile/verify";
import { activeTabMessenger } from "./active-tab/events";
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
 * クレデンシャルの取得、Target Integrity の検証、準備完了の通知をおこなう。
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

  // Side Panel にコンテンツスクリプトの準備完了を通知する
  const notifyReady = () => {
    void activeTabMessenger.sendMessage("contentReady", null);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", notifyReady, { once: true });
  } else {
    notifyReady();
  }

  // bfcache から復元された場合、Content Script は再注入されないため
  // pageshow イベントで contentReady を再送信する
  // see: https://developer.chrome.com/blog/bfcache-extension-messaging-changes
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      notifyReady();
    }
  });
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
