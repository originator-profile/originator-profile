import { activeTabMessenger } from "./components/activeTab/events";
import { credentialsMessenger } from "./components/credentials/events";
import type { LinkVerificationResult } from "./components/credentials/types";
import { frameCasExtensionMessenger } from "./components/frameCas";
import {
  handleAdClicked,
  handleVerification,
  pendingOpIdVerification,
  recentlyOpenedTabs,
  restoreVerificationFromCache,
  stateReady,
  verificationCache,
  verificationResults,
} from "./components/link-verification";
import { overlayExtensionMessenger } from "./components/overlay/extension-events";
import { updateBadge, verifyTabCredentials } from "./components/tabBadge";
import "./utils/cors-basic-auth";
import { normalizeUrl } from "./utils/navigation-state";

/** バッジ更新のデバウンス時間（ミリ秒） */
const BADGE_UPDATE_DEBOUNCE_MS = 300;

// Chromium: アクションクリック時にサイドパネルを開く
if (chrome.sidePanel) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);
}

// Firefox: アクションクリック時にサイドバーを開く
// （sidebarAction.open() はユーザージェスチャからのみ呼べる）
if (chrome.sidebarAction) {
  chrome.action.onClicked.addListener(() => {
    void chrome.sidebarAction.open();
  });

  // Firefox: サイドバー閉じる検知。
  // sidebarAction.isOpen() ポーリングで close を検知する。
  // see: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/sidebarAction
  const SIDEBAR_POLL_INTERVAL_MS = 500;
  const sidebarPollers = new Map<number, ReturnType<typeof setInterval>>();

  const stopPolling = (windowId: number) => {
    const timer = sidebarPollers.get(windowId);
    if (timer !== undefined) {
      clearInterval(timer);
      sidebarPollers.delete(windowId);
    }
  };

  activeTabMessenger.onMessage("firefoxSidebarOpened", ({ data }) => {
    const { windowId } = data;
    if (sidebarPollers.has(windowId)) return;

    const timer = setInterval(async () => {
      try {
        const isOpen = await chrome.sidebarAction.isOpen({ windowId });
        if (isOpen) return;

        stopPolling(windowId);
        const [tab] = await chrome.tabs.query({ active: true, windowId });
        if (tab?.id !== undefined) {
          void overlayExtensionMessenger.sendMessage("leave", null, tab.id);
        }
      } catch {
        // ウィンドウが既に閉じられている等の場合
        stopPolling(windowId);
      }
    }, SIDEBAR_POLL_INTERVAL_MS);
    sidebarPollers.set(windowId, timer);
  });

  // ウィンドウ自体が閉じられた場合のクリーンアップ
  chrome.windows.onRemoved.addListener((windowId) => {
    stopPolling(windowId);
  });
}

/**
 * タブのバッジを更新する
 * @param tabId タブID
 */
async function updateTabBadge(tabId: number): Promise<void> {
  try {
    const result = await verifyTabCredentials(tabId);
    await updateBadge(tabId, result?.count ?? 0);
  } catch (error) {
    console.error(
      `[updateTabBadge] Failed to update badge for tab ${tabId}:`,
      error,
    );
  }
}

// デバウンス用のタイマーID（タブIDごとに管理）
const pendingBadgeUpdateTimers = new Map<
  number,
  ReturnType<typeof setTimeout>
>();

/**
 * タブのバッジ更新をデバウンス付きで要求する
 * @param tabId タブID
 */
function requestTabBadgeUpdate(tabId: number): void {
  const existingTimer = pendingBadgeUpdateTimers.get(tabId);
  if (existingTimer !== undefined) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    pendingBadgeUpdateTimers.delete(tabId);
    void updateTabBadge(tabId);
  }, BADGE_UPDATE_DEBOUNCE_MS);

  pendingBadgeUpdateTimers.set(tabId, timer);
}

// タブ切り替え時にバッジを更新
chrome.tabs.onActivated.addListener(({ tabId }) => {
  requestTabBadgeUpdate(tabId);
});

// ページ遷移完了時にバッジを更新（アクティブタブのみ）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    requestTabBadgeUpdate(tabId);
  }
});

// タブ削除時にデバウンスタイマーをクリーンアップ
chrome.tabs.onRemoved.addListener((tabId) => {
  const timer = pendingBadgeUpdateTimers.get(tabId);
  if (timer !== undefined) {
    clearTimeout(timer);
    pendingBadgeUpdateTimers.delete(tabId);
  }
});

// 既存タブにContent Scriptを注入
async function injectContentScriptsToExistingTabs(): Promise<void> {
  const manifest = chrome.runtime.getManifest();
  const tabs = await chrome.tabs.query({});
  const injectableTabs = tabs.filter(
    (tab): tab is chrome.tabs.Tab & { id: number } =>
      tab.id !== undefined &&
      tab.url !== undefined &&
      /^https?:\/\//.test(tab.url),
  );

  const injections = (manifest.content_scripts ?? []).flatMap((cs) => {
    const files = cs.js;
    if (!files || files.length === 0) return [];

    return injectableTabs.map((tab) =>
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id, allFrames: cs.all_frames },
          files,
        })
        .catch(() => {
          // 注入できないページはスキップ
        }),
    );
  });

  await Promise.all(injections);
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") return;

  await injectContentScriptsToExistingTabs();

  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (activeTab?.id !== undefined) {
    requestTabBadgeUpdate(activeTab.id);
  }

  const granted = await chrome.permissions.contains({
    origins: ["<all_urls>"],
  });

  if (!granted) {
    // 権限が足らない場合は初期設定の説明を開く (Firefoxのみ)
    await chrome.tabs.create({
      url: "https://cip.docs.originator-profile.org/web-ext/experimental-use/#setup-in-firefox",
    });

    // NOTE: "<all_urls>" 権限求められないようなのでコメントアウト
    // const granted = await chrome.permissions.request({
    //   origins: ["<all_urls>"],
    // });
  }
});

// --- 広告リンク検証リスナー ---

// タブが閉じられたとき、メモリリーク防止のために状態をクリーンアップ
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await stateReady;
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
  await stateReady;
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

credentialsMessenger.onMessage("adClicked", async ({ data, sender }) => {
  await stateReady;
  if (sender.tab?.id) {
    handleAdClicked({
      tabId: sender.tab.id,
      targetOpId: data.targetopid,
      sourceOrgName: data.sourceOrgName,
      expectedOrgName: data.expectedOrgName,
      isNewTab: data.isNewTab,
      sourceUrl: sender.tab.url,
    });
  }
});

credentialsMessenger.onMessage(
  "getVerificationResult",
  async ({ data: tabId }) => {
    await stateReady;
    return (
      verificationResults.get(tabId) ??
      ({ status: "none" } satisfies LinkVerificationResult)
    );
  },
);

chrome.webNavigation.onCommitted.addListener(async (details) => {
  await stateReady;
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
  await stateReady;
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
      targetOpId: pending.targetOpId,
      sourceOrgName: pending.sourceOrgName,
      expectedOrgName: pending.expectedOrgName,
      sourceUrl: pending.sourceUrl,
      isNewTab: pending.isNewTab,
    });
  } else {
    // 保留中の検証がない場合（戻る/進むなど）はキャッシュから復元
    restoreVerificationFromCache(details.tabId, details.url);
  }
});

// --- フレームCAS ---

// iframeのCAS位置情報をコンテンツスクリプトに配信
frameCasExtensionMessenger.onMessage("prepareLocate", ({ data }) => {
  const { tabId, framesCas } = data;
  const targetFramesCas = framesCas.filter(
    (frameCas) => frameCas.cas.length > 0,
  );
  for (const frameCas of targetFramesCas) {
    void frameCasExtensionMessenger.sendMessage(
      "locating",
      {
        frameCas,
        frames: framesCas.map(({ cas: _, ...frame }) => frame),
      },
      {
        tabId,
        frameId: frameCas.frameId,
      },
    );
  }
});

// --- Basic Auth ---

if (import.meta.env.BASIC_AUTH) {
  for (const credential of import.meta.env.BASIC_AUTH_CREDENTIALS) {
    chrome.webRequest.onAuthRequired.addListener(
      () => ({
        authCredentials: {
          username: credential.username,
          password: credential.password,
        },
      }),
      {
        urls:
          credential.domain === "localhost"
            ? [
                "http://localhost:8080/*",
                // Firefox のため
                "http://localhost/*",
              ]
            : [`https://${credential.domain}/*`],
      },
      ["blocking"],
    );
  }
}
