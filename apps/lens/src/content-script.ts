import {
  frameCasWindowMessenger,
  overlayExtensionMessenger,
} from "@originator-profile/extension-common";
import { setupOnce } from "@originator-profile/extension-common/content-script";
import { Overlay } from "./components/overlay";
import { lensOverlayMessenger, type Highlight } from "./overlay/protocol";
import { lensOverlayWindowMessenger } from "./overlay/window-protocol";

setupOnce("content-script", () => {
  const overlay = new Overlay();
  let current: Highlight | undefined;

  const show = () => {
    if (!current) return;
    lensOverlayWindowMessenger.sendMessage(
      "showHighlight",
      current,
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
    if (current?.kind !== "content") return;
    const { key, targets } = current;
    const frames = current.frames.filter(({ frameId }) => frameId !== 0);
    if (frames.length === 0) return;
    void lensOverlayMessenger.sendMessage(
      "locateTargets",
      frames.map(({ frameId, parentFrameId }) => ({
        frameId,
        parentFrameId,
        cas: [{ id: key, targets }],
      })),
    );
  });
});
