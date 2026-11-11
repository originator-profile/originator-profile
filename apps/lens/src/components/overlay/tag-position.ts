/**
 * タグの置き場所
 *
 * - above: 範囲の上。しっぽは下を向く
 * - below: 範囲の下。しっぽは上を向く
 * - inside: 範囲の見えている部分の上端の内側。しっぽは上を向く
 */
export type TagPlacement = "above" | "below" | "inside";

export type TagPosition = {
  placement: TagPlacement;
  /** タグの基準の y 座標。above ではタグの下端、それ以外では上端 */
  top: number;
  /** タグの左端の x 座標 */
  left: number;
  /** しっぽの x 座標 (タグの左端から) */
  tailX: number;
};

/** しっぽの高さ */
export const TAIL_SIZE = 8;
/** タグを画面の左右の端から離す幅 */
const EDGE_MARGIN = 8;
/** しっぽをタグの左右の端から離す幅 (角丸としっぽの半分) */
const TAIL_INSET = 16;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * 強調した範囲に添えるタグの置き場所を決める
 *
 * 範囲の上に置けなければ下に、どちらにも置けなければ範囲の見えている部分の
 * 内側に置く。左右は範囲の中央に合わせ、画面からはみ出す分だけずらす
 * @param rect 強調した範囲
 * @param viewport 画面の大きさ
 * @param tag タグの大きさ (しっぽを除く)
 */
export function tagPositionOf(
  rect: Pick<DOMRect, "top" | "bottom" | "left" | "width">,
  viewport: { width: number; height: number },
  tag: { width: number; height: number },
): TagPosition {
  const space = tag.height + TAIL_SIZE;
  const placement: TagPlacement =
    rect.top >= space
      ? "above"
      : rect.bottom + space <= viewport.height
        ? "below"
        : "inside";
  const top = {
    above: rect.top,
    below: rect.bottom,
    inside: Math.max(rect.top, 0),
  }[placement];
  const center = rect.left + rect.width / 2;
  const left = clamp(
    center - tag.width / 2,
    EDGE_MARGIN,
    viewport.width - tag.width - EDGE_MARGIN,
  );
  const tailX = clamp(center - left, TAIL_INSET, tag.width - TAIL_INSET);
  return { placement, top, left, tailX };
}
