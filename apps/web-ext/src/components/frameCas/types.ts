import { type ContentAttestation } from "@originator-profile/model";
import type { FrameResponse } from "../credentials";

export type AncestorFrameCoordinate = FrameResponse & {
  /** 水平方向のスクロール量 */
  scrollX: number;
  /** 垂直方向のスクロール量 */
  scrollY: number;
  /** 親フレームを原点とするフレームの座標 */
  rect: DOMRect;
  /** 可視判定 */
  visible: boolean;
};

export type FrameCoordinate = FrameResponse & {
  /** 最上位から末端までのフレームの座標 */
  ancestor: AncestorFrameCoordinate[];
  /** 水平方向のスクロール量 */
  scrollX: number;
  /** 垂直方向のスクロール量 */
  scrollY: number;
};

export type CaCoordinate = {
  id: ContentAttestation["credentialSubject"]["id"];
  /** CA が設置されたフレームを原点とする Content Integrity Descriptor の座標 */
  target: DOMRect[];
};

export type CasCoordinate = CaCoordinate[];

export type FrameCasCoordinate = FrameCoordinate & {
  cas: CasCoordinate;
};
