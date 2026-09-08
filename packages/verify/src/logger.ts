/**
 * 検証中のメッセージを受け取るロガー
 * - `warn`: 警告
 *   主に互換性 (非推奨 Certificate や digestSRI の欠落・不一致など) の通知に使用
 * - `info`: システムの正常な動作記録
 *   (Profile Annotation Issuer 登録証 PA 未保有など、無効性を意味しない状態) の通知に使用する。
 */
export type Logger = Pick<Console, "warn" | "info">;
