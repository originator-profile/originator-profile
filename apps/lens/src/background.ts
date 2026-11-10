import { readTabVerification } from "@originator-profile/extension-common";
import { setupBackground } from "@originator-profile/extension-common/background";
import { countCredentials } from "./components/tabBadge";
import { documentFramesOf } from "./overlay/frames";
import { lensOverlayMessenger } from "./overlay/protocol";

setupBackground({
  buildWarningUrl: (params) =>
    `${chrome.runtime.getURL("index.html")}#/warning?${params.toString()}`,
  countCredentials,
});

// サブフレームでの位置の計測を、そのフレームの content script に中継する
lensOverlayMessenger.onMessage("locateTargets", async ({ data, sender }) => {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return;
  const frames = documentFramesOf(await readTabVerification(tabId));
  void lensOverlayMessenger.sendMessage(
    "measureTargets",
    { target: data, frames },
    { tabId, frameId: data.frameId },
  );
});
