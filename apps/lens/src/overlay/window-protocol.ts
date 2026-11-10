import { defineWindowMessaging } from "@originator-profile/extension-common";
import type { Highlight } from "./protocol";

/**
 * トップレベル文書とオーバーレイの iframe のあいだのメッセージ
 *
 * NOTE: iframe はページの文脈で動き、拡張機能の API を使えない。iframe から
 * 読み込むモジュールは、拡張機能のメッセージング (protocol.ts の
 * lensOverlayMessenger) を値として読み込んではならない。読み込むと
 * webextension-polyfill が例外を投げ、iframe が何も描画しない
 */
export type LensOverlayWindowProtocolMap = {
  /** iframe → 親: 現在の強調を求める */
  requestHighlight(message: null): void;
  /** 親 → iframe: 強調の開始・更新 */
  showHighlight(message: Highlight): void;
};

export const lensOverlayWindowMessenger =
  defineWindowMessaging<LensOverlayWindowProtocolMap>();
