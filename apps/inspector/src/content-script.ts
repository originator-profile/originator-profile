import { serializeIfError } from "@originator-profile/core";
import {
  type FrameVerifiedCas,
  OverlayProtocolMap,
  frameCasExtensionMessenger,
  frameCasWindowMessenger,
  overlayExtensionMessenger,
  overlayWindowMessenger,
  siteProfileMessenger,
} from "@originator-profile/extension-common";
import { fetchSiteProfile } from "@originator-profile/presentation";
import { Overlay } from "./components/overlay";

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

siteProfileMessenger.onMessage("fetchSiteProfile", async () => {
  const data = await fetchSiteProfile(document);
  return serializeIfError(data);
});

let tabId: number;
let framesCas: FrameVerifiedCas[] = [];

frameCasExtensionMessenger.onMessage("prepareLocate", ({ data }) => {
  tabId = data.tabId;
  framesCas = data.framesCas;
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
