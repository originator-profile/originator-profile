import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router";
import App from "./App";
import "./style.css";
import "./utils/cors-basic-auth";

function useTabTracking() {
  React.useEffect(() => {
    // アクティブタブを取得してハッシュを設定する関数
    const navigateToTab = (tabId: number) => {
      const currentHash = window.location.hash;
      const tabPrefix = `#/tab/${tabId}`;
      // 既に同じタブを表示中なら何もしない
      if (currentHash.startsWith(tabPrefix)) return;
      window.location.hash = `/tab/${tabId}`;
    };

    // 初期タブIDを取得
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id !== undefined) navigateToTab(tab.id);
    });

    // タブ切り替え時にURLを更新
    const listener = ({ tabId }: chrome.tabs.OnActivatedInfo) => {
      navigateToTab(tabId);
    };
    chrome.tabs.onActivated.addListener(listener);

    // 同一タブ内でのページ遷移時もURLをリセット
    const updatedListener = (
      tabId: number,
      updatedInfo: chrome.tabs.OnUpdatedInfo,
      tab: chrome.tabs.Tab,
    ) => {
      if (updatedInfo.status === "complete" && tab.active) {
        navigateToTab(tabId);
      }
    };
    chrome.tabs.onUpdated.addListener(updatedListener);

    return () => {
      chrome.tabs.onActivated.removeListener(listener);
      chrome.tabs.onUpdated.removeListener(updatedListener);
    };
  }, []);
}

function Root() {
  useTabTracking();

  return (
    <HashRouter>
      <App />
    </HashRouter>
  );
}

const init = () => {
  const root = document.getElementById("root");
  if (!root) return;
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  );
};

init();
