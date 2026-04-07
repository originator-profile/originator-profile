import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router";
import App from "./App";
import { overlayExtensionMessenger } from "./components/overlay/extension-events";
import "./style.css";
import "./utils/cors-basic-auth";

// サイドパネルが非表示になったとき、アクティブタブのオーバーレイを解除する。
// React のライフサイクルに依存せず、サイドパネルが存在する限り有効。
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
