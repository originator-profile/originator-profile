import { defineWindowMessaging } from "../windowMessaging";
import { type FrameCasCoordinate } from "./types";
import type { FrameResponse, FrameLocation } from "../credentials";

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
