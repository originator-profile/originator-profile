import type { FrameLocation, FrameResponse } from "../credentials/types";
import { defineWindowMessaging } from "../window-messaging";
import { type FrameCasCoordinate } from "./types";

export type FrameCasWindowProtocolMap = {
  startLocate(message: null): void;
  locating(message: {
    frameCas: FrameCasCoordinate;
    frames: Array<FrameResponse & FrameLocation>;
  }): void;
  located(message: FrameCasCoordinate): void;
};

export const frameCasWindowMessenger =
  defineWindowMessaging<FrameCasWindowProtocolMap>();
