import { basicFilter, lookup } from "bcp-47-match";

/**
 * VCの@contextから@languageタグを取得
 * @param vc Verifiable Credential
 * @returns 言語タグ (例: "ja", "en-GB") または undefined
 */
function getLanguageTag(vc: { "@context": unknown }): string | undefined {
  const context = vc["@context"];
  if (!Array.isArray(context)) return undefined;

  for (const item of context) {
    if (typeof item === "object" && item !== null && "@language" in item) {
      return item["@language"] as string;
    }
  }
  return undefined;
}

/**
 * VCリストから言語タグとアイテムのマッピングを構築
 */
function buildTagMap<T extends { "@context": unknown }>(
  items: T[],
): { tagToItem: Map<string, T>; tags: string[] } {
  const tagToItem = new Map<string, T>();
  const tags: string[] = [];
  for (const item of items) {
    const tag = getLanguageTag(item);
    if (tag && !tagToItem.has(tag)) {
      tagToItem.set(tag, item);
      tags.push(tag);
    }
  }
  return { tagToItem, tags };
}

/**
 * basicFilterの結果から完全一致を優先して返す
 */
function findBestMatch(
  filtered: string[],
  userLocale: string,
): string | undefined {
  if (filtered.length === 0) return undefined;
  const exact = filtered.find(
    (t) => t.toLowerCase() === userLocale.toLowerCase(),
  );
  return exact ?? filtered[0];
}

/**
 * ユーザーロケールに基づいてVCを選択
 *
 * フォールバック優先順位:
 * 1. basicFilter: タグがユーザーロケールのサブタグか (完全一致優先)
 * 2. lookup: ユーザーロケールを縮小してマッチ
 * 3. 言語コードが "en" にマッチするVC
 * 4. 配列の最初の要素
 *
 * @param items VC配列
 * @returns 選択されたVC または undefined (配列が空の場合)
 */
export function selectByLocale<T extends { "@context": unknown }>(
  items: T[],
): T | undefined {
  if (items.length === 0) return undefined;
  if (items.length === 1) return items[0];

  const { tagToItem, tags } = buildTagMap(items);
  const userLocale =
    typeof navigator !== "undefined" ? navigator.language : "en";

  // 1. basicFilter: タグがユーザーロケールのサブタグか (例: ja → ja-JP)
  const filtered = basicFilter(tags, userLocale);
  const bestMatch = findBestMatch(filtered, userLocale);
  if (bestMatch) return tagToItem.get(bestMatch) ?? items[0];

  // 2. lookup: ユーザーロケールを縮小してマッチ (例: ja-JP → ja)
  const lookupTag = lookup(tags, userLocale);
  if (lookupTag) return tagToItem.get(lookupTag) ?? items[0];

  // 3. 'en' にフォールバック
  const enTag = lookup(tags, "en");
  if (enTag) return tagToItem.get(enTag) ?? items[0];

  // 4. 最初の要素にフォールバック
  return items[0];
}
