import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router";
import App from "./App";
import { activeTabMessenger } from "./components/activeTab/events";
import { overlayExtensionMessenger } from "./components/overlay/extension-events";
import "./style.css";
import "./utils/cors-basic-auth";

// サイドパネルが非表示になったとき、アクティブタブのオーバーレイを解除する。
// React のライフサイクルに依存せず、サイドパネルが存在する限り有効。
// NOTE: Firefox 147.0.4 では到達しない
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "hidden") return;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id !== undefined) {
      void overlayExtensionMessenger.sendMessage("leave", null, tab.id);
    }
  } catch {
    // サイドパネル非表示時にタブ情報を取得できない場合は無視する
  }
});

// Firefox: background 側にサイドバー起動を通知して
// sidebarAction.isOpen() ポーリングによる close 検知を行う。
if (chrome.sidebarAction) {
  void chrome.windows.getCurrent().then((win) => {
    if (win.id !== undefined) {
      void activeTabMessenger.sendMessage("firefoxSidebarOpened", {
        windowId: win.id,
      });
    }
  });
}

const init = () => {
  const root = document.getElementById("root");
  if (!root) return;
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>,
  );
};

init();
