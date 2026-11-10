import {
  frameCasWindowMessenger,
  overlayExtensionMessenger,
} from "@originator-profile/extension-common";
import { setupOnce } from "@originator-profile/extension-common/content-script";
import { Overlay } from "./components/overlay";
import {
  lensOverlayMessenger,
  type LensOverlayProtocolMap,
} from "./overlay/protocol";
import { lensOverlayWindowMessenger } from "./overlay/window-protocol";

type ShowHighlight = Parameters<LensOverlayProtocolMap["showHighlight"]>[0];

setupOnce("content-script", () => {
  const overlay = new Overlay();
  let current: ShowHighlight | undefined;

  const show = () => {
    if (!current) return;
    lensOverlayWindowMessenger.sendMessage(
      "showHighlight",
      current.highlight,
      overlay.window,
    );
  };

  lensOverlayMessenger.onMessage("showHighlight", ({ data }) => {
    current = data;
    overlay.activate();
    show();
  });

  overlayExtensionMessenger.onMessage("leave", () => {
    current = undefined;
    overlay.deactivate();
  });

  // NOTE: iframe は読み込みを終えてから強調を求める。activate 直後の送信は届かない
  lensOverlayWindowMessenger.onMessage("requestHighlight", show);

  frameCasWindowMessenger.onMessage("located", ({ data }) => {
    frameCasWindowMessenger.sendMessage("located", data, overlay.window);
  });

  frameCasWindowMessenger.onMessage("startLocate", () => {
    const highlight = current?.highlight;
    if (highlight?.kind !== "content" || highlight.frame.frameId === 0) return;
    const { frameId, parentFrameId } = highlight.frame;
    void lensOverlayMessenger.sendMessage("locateTargets", {
      target: {
        frameId,
        parentFrameId,
        cas: [{ id: highlight.key, targets: highlight.targets }],
      },
      frames: current?.frames ?? [],
    });
  });
});
