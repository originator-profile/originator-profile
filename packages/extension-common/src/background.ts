import { activeTabMessenger } from "./active-tab/events";
import { injectContentScriptsToExistingTabs } from "./content-script-injection";
import { frameCasExtensionMessenger } from "./frame-cas/extension-events";
import { setupLinkVerification } from "./link-verification/background";
import type { WarningUrlBuilder } from "./link-verification/types";
import { overlayExtensionMessenger } from "./overlay/extension-events";
import { setupTabBadge } from "./tab-badge/background";
import { setupVerificationPipeline } from "./verification/background";
import type { TabVerification } from "./verification/types";

/** Firefox のサイドバーの開閉を検知するポーリング間隔（ミリ秒） */
const SIDEBAR_POLL_INTERVAL_MS = 500;

/** {@link setupBackground} に与えるアプリ固有の設定 */
export type BackgroundConfig = {
  /** 警告ページの URL を組み立てる */
  buildWarningUrl: WarningUrlBuilder;
  /** タブのバッジに表示するクレデンシャルの件数を数える */
  countCredentials: (verification: TabVerification) => number;
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
  setupVerificationPipeline();
  setupLinkVerification(config.buildWarningUrl);
  setupTabBadge(config.countCredentials);

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
    if (reason !== "install" && reason !== "update") return;

    // NOTE: 既存のタブにはマニフェストの content script が入っていないか、更新前の
    // 拡張機能のものが残っていて Service Worker と通信できない。注入された
    // content script が検証を求め、その結果でバッジが更新される
    await injectContentScriptsToExistingTabs();
    if (reason !== "install") return;

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
