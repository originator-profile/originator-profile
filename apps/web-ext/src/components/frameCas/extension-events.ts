import { defineExtensionMessaging } from "@webext-core/messaging";
import type {
  FrameVerifiedCas,
  FrameResponse,
  FrameLocation,
} from "../credentials";

export type FrameCasExtensionProtocolMap = {
  locate(message: {
    frameCas: FrameVerifiedCas;
    frames: Array<FrameResponse & FrameLocation>;
  }): Promise<void>;
  reLocate(): void;
};

export const frameCasExtensionMessenger =
  defineExtensionMessaging<FrameCasExtensionProtocolMap>();
