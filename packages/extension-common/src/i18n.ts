/// <reference types="chrome"/>

/**
 * ロケールに合わせたメッセージ文字列を取得する
 * @param msg メッセージカタログのキーとなる文字列
 * @param substitutions ローカライズされたメッセージ文字列内のプレースホルダーを置き換える文字列
 * @returns ローカライズされたメッセージ文字列
 */
export function getMessage(msg: string, substitutions?: string | string[]) {
  return chrome.i18n.getMessage(msg, substitutions);
}

export const _ = getMessage;
