import { defineExtensionMessaging } from "@webext-core/messaging";
import type {
  FrameLocation,
  FrameResponse,
  FrameVerifiedCas,
} from "../credentials";

export type FrameCasExtensionProtocolMap = {
  prepareLocate(message: {
    tabId: number;
    framesCas: FrameVerifiedCas[];
  }): void;
  locating(message: {
    frameCas: FrameVerifiedCas;
    frames: Array<FrameResponse & FrameLocation>;
  }): void;
};

export const frameCasExtensionMessenger =
  defineExtensionMessaging<FrameCasExtensionProtocolMap>();
