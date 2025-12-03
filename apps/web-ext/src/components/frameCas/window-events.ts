import { defineWindowMessaging } from "../windowMessaging";
import { type FrameCasCoordinate } from "./types";
import type { FrameResponse, FrameLocation } from "../credentials";

export type FrameCasWindowProtocolMap = {
  locate(message: {
    frameCas: FrameCasCoordinate;
    frames: Array<FrameResponse & FrameLocation>;
  }): void;
  reLocate(): void;
};

export const frameCasWindowMessenger =
  defineWindowMessaging<FrameCasWindowProtocolMap>();
