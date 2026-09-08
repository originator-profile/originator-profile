import { defineExtensionMessaging } from "@webext-core/messaging";
import { OverlayProtocolMap } from "./window-events";

export const overlayExtensionMessenger =
  defineExtensionMessaging<OverlayProtocolMap>();
