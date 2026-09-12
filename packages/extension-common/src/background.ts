import { activeTabMessenger } from "./active-tab/events";
import { frameCasExtensionMessenger } from "./frame-cas/extension-events";
import { setupLinkVerification } from "./link-verification/background";
import type { WarningUrlBuilder } from "./link-verification/types";
import { overlayExtensionMessenger } from "./overlay/extension-events";
import { setupTabBadge } from "./tab-badge/background";

/** Firefox のサイドバーの開閉を検知するポーリング間隔（ミリ秒） */
const SIDEBAR_POLL_INTERVAL_MS = 500;

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

/** {@link setupBackground} に与えるアプリ固有の設定 */
export type BackgroundConfig = {
  /** 警告ページの URL を組み立てる */
  buildWarningUrl: WarningUrlBuilder;
  /** タブのバッジに表示するクレデンシャルの件数を数える */
  countCredentials: (tabId: number) => Promise<number>;
  /** 権限が足りないときに開く案内ページ */
  permissionGuideUrl: string;
};

/**
 * Service Worker のイベント配線を登録する
 *
 * 拡張機能ごとに異なる部分 (警告ページの場所、バッジの数え方、案内ページ) は
 * 引数で受け取る。
 * @param config アプリ固有の設定
 */
export function setupBackground(config: BackgroundConfig) {
  setupLinkVerification(config.buildWarningUrl);
  const { requestTabBadgeUpdate } = setupTabBadge(config.countCredentials);

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
      await chrome.tabs.create({ url: config.permissionGuideUrl });
    }
  });

  // --- フレームCAS ---

  // iframeのCAS位置情報をコンテンツスクリプトに配信
  frameCasExtensionMessenger.onMessage("prepareLocate", ({ data }) => {
    const { tabId, framesCas } = data;
    const targetFramesCas = framesCas.filter(
      (frameCas) => frameCas.cas.length > 0,
    );
    const frames = framesCas.map(({ cas: _, ...frame }) => frame);
    for (const frameCas of targetFramesCas) {
      void frameCasExtensionMessenger.sendMessage(
        "locating",
        { frameCas, frames },
        {
          tabId,
          frameId: frameCas.frameId,
        },
      );
    }
  });
}
