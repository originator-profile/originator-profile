import { WebMediaProfile } from "@originator-profile/model";
import { SupportedVerifiedCa, SupportedVerifiedCas } from "../credentials";
import { defineWindowMessaging } from "../windowMessaging";

export type OverlayProtocolMap = {
  /** オーバーレイの開始・更新 */
  enter(message: {
    cas: SupportedVerifiedCas;
    activeCa: SupportedVerifiedCa | null;
    wmps: WebMediaProfile[];
  }): void;
  /** オーバーレイの終了 */
  leave(message: null): void;
  /** オーバーレイ上 CA の選択 */
  select(message: { activeCa: SupportedVerifiedCa }): void;
};

export const overlayWindowMessenger =
  defineWindowMessaging<OverlayProtocolMap>();
