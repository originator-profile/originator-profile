import { normalizeUrl } from "../utils/navigation-state";
import { linkVerificationMessenger } from "./events";
import {
  createLinkVerificationHandlers,
  restoreVerificationFromCache,
} from "./handlers";
import {
  ensureStateLoaded,
  pendingOpIdVerification,
  recentlyOpenedTabs,
  verificationCache,
  verificationResults,
} from "./state";
import type { LinkVerificationResult, WarningUrlBuilder } from "./types";

/** 広告リンク検証の Service Worker 側イベント配線を登録する */
export function setupLinkVerification(buildWarningUrl: WarningUrlBuilder) {
  const { handleAdClicked, handleVerification } =
    createLinkVerificationHandlers(buildWarningUrl);

  // タブが閉じられたとき、メモリリーク防止のために状態をクリーンアップ
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    await ensureStateLoaded();
    pendingOpIdVerification.delete(tabId);
    verificationResults.delete(tabId);
    verificationCache.delete(tabId);
    recentlyOpenedTabs.delete(tabId);
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "clearPendingVerification") {
      // 送信元が拡張機能の Warning ページであることを検証
      const isFromExtension = sender.url?.startsWith(chrome.runtime.getURL(""));
      if (!isFromExtension) {
        sendResponse({ success: false, reason: "unauthorized sender" });
        return;
      }
      if (sender.tab?.id) {
        pendingOpIdVerification.delete(sender.tab.id);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, reason: "no tab id" });
      }
      return;
    }
    return false;
  });

  chrome.tabs.onCreated.addListener(async (tab) => {
    await ensureStateLoaded();
    const openerId = tab.openerTabId;
    if (openerId !== undefined && tab.id !== undefined) {
      // opener → new tab のマッピングを記録（FIFOキューで複数クリック時の順序を維持）
      const existing = recentlyOpenedTabs.get(openerId) || [];
      existing.push(tab.id);
      recentlyOpenedTabs.set(openerId, existing);

      // 元タブに pendingOpIdVerification があれば即座にコピー（新規タブとしてマーク）
      const pending = pendingOpIdVerification.get(openerId);
      if (pending && !pendingOpIdVerification.get(tab.id)) {
        pendingOpIdVerification.set(tab.id, { ...pending, isNewTab: true });
      }
    }
  });

  linkVerificationMessenger.onMessage("adClicked", async ({ data, sender }) => {
    await ensureStateLoaded();
    if (sender.tab?.id) {
      handleAdClicked({
        tabId: sender.tab.id,
        context: {
          targetOpId: data.targetopid,
          sourceOrgName: data.sourceOrgName,
          expectedOrgName: data.expectedOrgName,
        },
        isNewTab: data.isNewTab,
        sourceUrl: sender.tab.url,
      });
    }
  });

  linkVerificationMessenger.onMessage(
    "getVerificationResult",
    async ({ data: tabId }) => {
      await ensureStateLoaded();
      return (
        verificationResults.get(tabId) ??
        ({ status: "none" } satisfies LinkVerificationResult)
      );
    },
  );

  chrome.webNavigation.onCommitted.addListener(async (details) => {
    await ensureStateLoaded();
    if (details.frameId !== 0) return;

    const isFromAddressBar =
      details.transitionQualifiers.includes("from_address_bar");
    const isForwardBack = details.transitionQualifiers.includes("forward_back");
    const isBookmark = details.transitionType === "auto_bookmark";
    const isReload = details.transitionType === "reload";
    const isClientRedirect =
      details.transitionQualifiers.includes("client_redirect");
    const isServerRedirect =
      details.transitionQualifiers.includes("server_redirect");

    const isTypedOrGenerated = [
      "typed",
      "generated",
      "keyword",
      "keyword_generated",
    ].includes(details.transitionType);

    // 明示的な手動操作やリロードの場合はキャンセル
    if (isFromAddressBar || isForwardBack || isBookmark || isReload) {
      pendingOpIdVerification.delete(details.tabId);
      return;
    }

    // typedやgenerated（外部アプリからのリンク等含む）でも、
    // リダイレクト（window.open() 等で付与されることが多い）を伴わない場合は手動遷移とみなしてキャンセル
    if (isTypedOrGenerated && !isClientRedirect && !isServerRedirect) {
      pendingOpIdVerification.delete(details.tabId);
      return;
    }
  });

  chrome.webNavigation.onCompleted.addListener(async (details) => {
    await ensureStateLoaded();
    if (details.frameId !== 0) return;
    if (details.url.startsWith(chrome.runtime.getURL(""))) return;

    // Navigate したら結果をリセット
    verificationResults.delete(details.tabId);

    const pending = pendingOpIdVerification.get(details.tabId);
    if (pending) {
      if (
        pending.warnedUrl &&
        normalizeUrl(pending.warnedUrl) !== normalizeUrl(details.url)
      ) {
        // 警告画面から別のURLへ手動ナビゲートした（または新規タブで別URLを開いた）場合は、検証フローを中止する
        pendingOpIdVerification.delete(details.tabId);
        restoreVerificationFromCache(details.tabId, details.url);
        return;
      }

      await handleVerification({
        tabId: details.tabId,
        url: details.url,
        context: pending,
        sourceUrl: pending.sourceUrl,
        isNewTab: pending.isNewTab,
      });
    } else {
      // 保留中の検証がない場合（戻る/進むなど）はキャッシュから復元
      restoreVerificationFromCache(details.tabId, details.url);
    }
  });
}
