import { WebMediaProfile } from "@originator-profile/model";
import { FramesVerifiedCas, SupportedVerifiedCa } from "../credentials";
import { listCas } from "../credentials/cas";
import { defineWindowMessaging } from "../windowMessaging";

export type CaFilterType = Parameters<typeof listCas>[1];

export type OverlayProtocolMap = {
  /** オーバーレイの開始・更新 */
  enter(message: {
    framesCas: FramesVerifiedCas;
    activeCa: SupportedVerifiedCa | null;
    wmps: WebMediaProfile[];
    filterType?: CaFilterType;
  }): void;
  /** オーバーレイの終了 */
  leave(message: null): void;
  /** オーバーレイ上 CA の選択 */
  select(message: { activeCa: SupportedVerifiedCa }): void;
};

export const overlayWindowMessenger =
  defineWindowMessaging<OverlayProtocolMap>();
