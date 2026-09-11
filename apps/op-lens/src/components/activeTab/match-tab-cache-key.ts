import type { Arguments } from "swr";

/**
 * SWR キャッシュキーが指定された tabId に関連するかを判定する。
 * 配列キー `[key, tabId, ...]` とオブジェクトキー `{ tabId, ... }` の両方に対応する。
 */
export const matchTabCacheKey =
  (tabId: number) =>
  (key?: Arguments): boolean =>
    (Array.isArray(key) && key[1] === tabId) ||
    (typeof key === "object" &&
      key !== null &&
      "tabId" in key &&
      (key as { tabId: unknown }).tabId === tabId);
