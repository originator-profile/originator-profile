import type {
  DocumentFrame,
  FrameLocation,
  FrameResponse,
} from "@originator-profile/extension-common";
import type { Target } from "@originator-profile/model";
import { defineExtensionMessaging } from "@webext-core/messaging";

/** 強調する範囲に添える発信者の組織 */
export type HighlightLabel = {
  name: string;
  /** ロゴの URL */
  logo?: string;
  /** ISO 3166-1 alpha-2 の国コード */
  country?: string;
};

/** ページ上で強調する範囲 */
export type Highlight =
  /** ページ全体 (Web サイトの運営者) */
  | { kind: "page"; label: HighlightLabel }
  /** コンテンツ */
  | {
      kind: "content";
      /** コンテンツの同一性 */
      key: string;
      /** コンテンツが出ているフレーム */
      frames: DocumentFrame[];
      targets: Target[];
      label?: HighlightLabel;
    };

/** サブフレームで位置を求める範囲 */
export type FrameTargets = FrameResponse & {
  cas: { id: string; targets: Target[] }[];
};

/**
 * 拡張機能のページ・Service Worker・content script のあいだのメッセージ
 *
 * NOTE: オーバーレイの終了は、Service Worker からも送るため extension-common の
 * overlayExtensionMessenger の leave を使う。ここでは同じ名前を定義しない
 */
export type LensOverlayProtocolMap = {
  /** サイドパネル → トップレベル文書: 強調の開始・更新 */
  showHighlight(message: Highlight): void;
  /**
   * トップレベル文書 → Service Worker: サブフレームでの位置の計測を求める
   *
   * NOTE: Service Worker はタブの検証の状態を読んでから中継する。フレームごとに
   * 送ると読み直しが重なるため、計測するフレームをまとめて送る
   */
  locateTargets(message: FrameTargets[]): void;
  /** Service Worker → サブフレーム: 位置を計測して親フレームへ送る */
  measureTargets(message: {
    target: FrameTargets;
    /** タブの文書のフレーム。位置を親フレームへ送るときにオリジンを引く */
    frames: Array<FrameResponse & FrameLocation>;
  }): void;
};

export const lensOverlayMessenger =
  defineExtensionMessaging<LensOverlayProtocolMap>();
