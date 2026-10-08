import {
  type FrameVerifiedCas,
  OverlayProtocolMap,
  frameCasExtensionMessenger,
  frameCasWindowMessenger,
  overlayExtensionMessenger,
  overlayWindowMessenger,
} from "@originator-profile/extension-common";
import {
  setupOnce,
  setupTopFrameHandlers,
} from "@originator-profile/extension-common/content-script";
import { Overlay } from "./components/overlay";

setupOnce("content-script", () => {
  setupTopFrameHandlers();

  const overlay = new Overlay();
  let enter: Parameters<OverlayProtocolMap["enter"]>[0] = {
    framesCas: [],
    activeCa: null,
    wmps: [],
  };

  overlayExtensionMessenger.onMessage("enter", ({ data }) => {
    overlay.activate();
    enter = data;
    overlayWindowMessenger.sendMessage("enter", data, overlay.window);
  });

  overlayExtensionMessenger.onMessage("leave", ({ data }) => {
    overlayWindowMessenger.sendMessage("leave", data, overlay.window);
  });

  overlayWindowMessenger.onMessage("enter", () => {
    overlayWindowMessenger.sendMessage("enter", enter, overlay.window);
  });

  overlayWindowMessenger.onMessage("leave", () => {
    overlay.deactivate();
  });

  overlayWindowMessenger.onMessage("select", ({ data }) => {
    void overlayExtensionMessenger.sendMessage("select", data);
  });

  let tabId: number;
  let framesCas: FrameVerifiedCas[] = [];
  /** 位置を求める CA の組。同じ組なら求め直さない */
  const locatedKeyOf = (framesCas: FrameVerifiedCas[]) =>
    JSON.stringify(
      framesCas.map(({ frameId, cas }) => [
        frameId,
        cas.map(({ attestation }) => attestation.doc.credentialSubject.id),
      ]),
    );

  frameCasExtensionMessenger.onMessage("prepareLocate", ({ data }) => {
    const changed = locatedKeyOf(data.framesCas) !== locatedKeyOf(framesCas);
    tabId = data.tabId;
    framesCas = data.framesCas;
    // NOTE: 文書の検証結果は文書ごとに後から届く。表示中のオーバーレイも追従させる
    if (!changed || !overlay.active) return;
    enter = { ...enter, framesCas };
    overlayWindowMessenger.sendMessage("enter", enter, overlay.window);
    void frameCasExtensionMessenger.sendMessage("prepareLocate", {
      tabId,
      framesCas,
    });
  });

  frameCasWindowMessenger.onMessage("located", ({ data }) => {
    frameCasWindowMessenger.sendMessage("located", data, overlay.window);
  });

  frameCasWindowMessenger.onMessage("startLocate", () => {
    void frameCasExtensionMessenger.sendMessage("prepareLocate", {
      tabId,
      framesCas,
    });
  });
});
