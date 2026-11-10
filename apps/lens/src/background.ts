import { setupBackground } from "@originator-profile/extension-common/background";
import { countCredentials } from "./components/tabBadge";
import { lensOverlayMessenger } from "./overlay/protocol";

setupBackground({
  buildWarningUrl: (params) =>
    `${chrome.runtime.getURL("index.html")}#/warning?${params.toString()}`,
  countCredentials,
});

// サブフレームでの位置の計測を、そのフレームの content script に中継する
lensOverlayMessenger.onMessage("locateTargets", ({ data, sender }) => {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return;
  void lensOverlayMessenger.sendMessage("measureTargets", data, {
    tabId,
    frameId: data.target.frameId,
  });
});
