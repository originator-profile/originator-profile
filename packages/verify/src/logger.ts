import type { ProblemDetails } from "./result/types";

/**
 * 検証中のメッセージを受け取るロガー
 * - `warn`: 警告
 *   主に互換性 (非推奨 Certificate や digestSRI の欠落・不一致など) の通知に使用
 * - `info`: システムの正常な動作記録
 *   (Profile Annotation Issuer 登録証 PA 未保有など、無効性を意味しない状態) の通知に使用する。
 *
 * 第 2 引数の `details` には構造化した通知内容を渡す。`console` をはじめ
 * 第 1 引数のみを受け取る実装も、そのまま渡せる。
 */
export type Logger = {
  warn(message: string, details?: ProblemDetails): void;
  info(message: string, details?: ProblemDetails): void;
};
