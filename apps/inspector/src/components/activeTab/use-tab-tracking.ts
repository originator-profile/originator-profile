import { useEffect, useEffectEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { paths, routes } from "../../utils/routes";

/**
 * アクティブタブを追跡し、タブ切替時に HashRouter の URL を更新するフック。
 * 自ウィンドウのタブのみを追跡し、別ウィンドウのタブ変更には反応しない。
 * Router コンテキスト内（HashRouter の子孫）で呼び出す必要がある。
 */
export function useTabTracking() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const navigateToTab = useEffectEvent((tabId: number) => {
    const base = routes.base.build({ tabId: String(tabId) });
    // 既に同じタブを表示中なら何もしない
    if (pathname.startsWith(base)) return;
    // タブに紐付かないページ（warning 等）表示中はスキップ
    if (pathname.startsWith(`/${paths.warning}`)) return;
    void navigate(base, { replace: true });
  });

  useEffect(() => {
    // NOTE: サイドパネル自身のタブは追跡しない。E2E テストはサイドパネルをタブとして
    // 開くため、追跡すると表示先がサイドパネル自身に上書きされる。本来のサイドパネル
    // はタブではないので undefined になる。
    const selfTabIdReady: Promise<number | undefined> = chrome.tabs
      .getCurrent()
      .then((tab) => tab?.id)
      .catch(() => undefined);
    const isTrackableTab = async (tab: chrome.tabs.Tab) =>
      tab.id !== (await selfTabIdReady);

    // window ID が取得できない場合は undefined → 全ウィンドウのタブを追跡する（退行動作）
    const windowIdReady: Promise<number | undefined> = chrome.windows
      .getCurrent()
      .then((win) => win.id)
      .catch(() => undefined);

    // タブ切り替え時にURLを更新（自ウィンドウのみ）
    const activatedListener = async ({
      tabId,
      windowId,
    }: chrome.tabs.OnActivatedInfo) => {
      const currentWindowId = await windowIdReady;
      if (currentWindowId !== undefined && windowId !== currentWindowId) return;
      try {
        const tab = await chrome.tabs.get(tabId);
        if (await isTrackableTab(tab)) {
          navigateToTab(tabId);
        }
      } catch {
        // タブが既に閉じられている場合
      }
    };
    chrome.tabs.onActivated.addListener(activatedListener);

    // アクティブタブの読み込み完了時にも表示先を合わせる。
    // 同一タブ内の Web ページ間遷移による再取得は useNavigationRefetch が担う。
    // 同一タブの場合 navigateToTab は pathname 一致で no-op になる。
    const updatedListener = async (
      tabId: number,
      updatedInfo: chrome.tabs.OnUpdatedInfo,
      tab: chrome.tabs.Tab,
    ) => {
      const currentWindowId = await windowIdReady;
      if (currentWindowId !== undefined && tab.windowId !== currentWindowId)
        return;
      if (
        updatedInfo.status === "complete" &&
        tab.active &&
        (await isTrackableTab(tab))
      ) {
        navigateToTab(tabId);
      }
    };
    chrome.tabs.onUpdated.addListener(updatedListener);

    // 初期タブIDを取得（リスナー登録後に実行し、取りこぼしを防ぐ）
    const queryInitialTab = async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab?.id !== undefined && (await isTrackableTab(tab))) {
          navigateToTab(tab.id);
        }
      } catch (error) {
        console.error("Failed to query initial active tab:", error);
      }
    };
    void queryInitialTab();

    return () => {
      chrome.tabs.onActivated.removeListener(activatedListener);
      chrome.tabs.onUpdated.removeListener(updatedListener);
    };
  }, []);
}
