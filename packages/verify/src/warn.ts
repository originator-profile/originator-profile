/**
 * 検証中の警告メッセージを受け取るハンドラー
 *
 * 検証を失敗とはしない後方互換性のための警告 (非推奨 Certificate や
 * digestSRI の欠落・不一致など) の通知に使用する。
 * デフォルトは `console.warn`。
 */
export type WarnHandler = (message: string) => void;
