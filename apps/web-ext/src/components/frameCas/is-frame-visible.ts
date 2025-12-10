/**
 * iframe 要素が親フレームのビューポート内に一部でも見えているかを判定する
 *
 * @param rect - iframe 要素の getBoundingClientRect() の結果
 * @param viewportWidth - ビューポートの幅（デフォルト: window.innerWidth）
 * @param viewportHeight - ビューポートの高さ（デフォルト: window.innerHeight）
 * @returns iframe が一部でもビューポート内に見えている場合 true
 */
export function isFrameVisible(
  rect: DOMRect,
  viewportWidth: number = window.innerWidth,
  viewportHeight: number = window.innerHeight,
): boolean {
  // サイズが 0 以下の場合は不可視とする
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  // ビューポートと交差しているかチェック（一部でも見えていれば true）
  return (
    rect.right > 0 &&
    rect.left < viewportWidth &&
    rect.bottom > 0 &&
    rect.top < viewportHeight
  );
}
