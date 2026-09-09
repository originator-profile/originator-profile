import { linkVerificationMessenger } from "./events";

/**
 * リンク検証結果を取得する
 * @param tabId タブID
 */
export const fetchVerificationResult = (tabId: number) =>
  linkVerificationMessenger.sendMessage("getVerificationResult", tabId);
