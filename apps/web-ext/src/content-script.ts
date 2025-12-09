import { serializeIfError } from "@originator-profile/core";
import { fetchSiteProfile } from "@originator-profile/presentation";
import {
  frameCasExtensionMessenger,
  frameCasWindowMessenger,
} from "./components/frameCas";
import {
  Overlay,
  OverlayProtocolMap,
  overlayWindowMessenger,
} from "./components/overlay";
import { type FrameVerifiedCas } from "./components/credentials";
import { overlayExtensionMessenger } from "./components/overlay/extension-events";
import { siteProfileMessenger } from "./components/siteProfile";
import { FetchSiteProfileMessageResult } from "./components/siteProfile/types";

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
  return serializeIfError(data) as FetchSiteProfileMessageResult;
});

let tabId: number;
let framesCas: FrameVerifiedCas[] = [];

frameCasExtensionMessenger.onMessage("prepareReLocate", ({ data }) => {
  tabId = data.tabId;
  framesCas = data.framesCas;
});

frameCasWindowMessenger.onMessage("located", ({ data }) => {
  frameCasWindowMessenger.sendMessage("located", data, overlay.window);
});

frameCasWindowMessenger.onMessage("reLocate", () => {
  void frameCasExtensionMessenger.sendMessage("prepareReLocate", {
    tabId,
    framesCas,
  });
});
