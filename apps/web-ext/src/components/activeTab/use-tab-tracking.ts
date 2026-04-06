import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { paths, routes } from "../../utils/routes";

/**
 * アクティブタブを追跡し、タブ切替時に HashRouter の URL を更新するフック。
 * Router コンテキスト内（HashRouter の子孫）で呼び出す必要がある。
 */
export function useTabTracking() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const navigateToTab = (tabId: number) => {
      const base = routes.base.build({ tabId: String(tabId) });
      // 既に同じタブを表示中なら何もしない
      if (pathname.startsWith(base)) return;
      // タブに紐付かないページ（warning 等）表示中はスキップ
      if (pathname.startsWith(`/${paths.warning}`)) return;
      void navigate(base, { replace: true });
    };

    // タブ切り替え時にURLを更新
    const activatedListener = ({ tabId }: chrome.tabs.OnActivatedInfo) => {
      navigateToTab(tabId);
    };
    chrome.tabs.onActivated.addListener(activatedListener);

    // 初期タブIDを取得（リスナー登録後に実行し、取りこぼしを防ぐ）
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab?.id !== undefined) navigateToTab(tab.id);
      });

    return () => {
      chrome.tabs.onActivated.removeListener(activatedListener);
    };
  }, [navigate, pathname]);
}
