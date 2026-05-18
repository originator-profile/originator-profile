import { basicFilter, lookup } from "bcp-47-match";

type LangSource = { "@context": unknown };

/** デフォルトの言語コンテキスト取得関数: アイテム自身が @context を持つと仮定 */
const defaultGetLangSource = <T>(item: T) => item as unknown as LangSource;

/**
 * @context から @language タグを取得
 */
function getLanguageTag(langSource: LangSource): string | undefined {
  const context = langSource["@context"];
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
function buildTagMap<T>(
  items: T[],
  getLangSource: (item: T) => LangSource,
): { tagToItem: Map<string, T>; tags: string[] } {
  const tagToItem = new Map<string, T>();
  const tags: string[] = [];
  for (const item of items) {
    const tag = getLanguageTag(getLangSource(item));
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
 * 単一グループからユーザーロケールに合致する 1 件を選択
 */
function selectOne<T>(
  items: T[],
  getLangSource: (item: T) => LangSource,
): T | undefined {
  if (items.length === 0) return undefined;
  if (items.length === 1) return items[0];

  const { tagToItem, tags } = buildTagMap(items, getLangSource);
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

type SelectByLocaleOptions<T> = {
  /**
   * @context を持つオブジェクトを取り出すアクセサ
   *
   * VerifiedVc など `.doc` 配下に @context を持つラッパー型を扱う際に指定します
   * 省略時はアイテム自身が @context を持つものとして扱われます
   */
  getLangSource?: (item: T) => LangSource;
  /**
   * 同一キーとみなすグループキーを取得する関数
   *
   * 指定するとアイテムをキー単位にグループ化し、各グループからユーザーロケールに
   * 合致する1件ずつを選択した配列を返します
   *
   * 同一の認証種別など、複数言語版が存在しうる VC 群を扱う場合に利用します
   */
  group?: (item: T) => string;
};

/**
 * ユーザーロケールに基づいて VC を選択
 *
 * フォールバック優先順位:
 * 1. basicFilter: タグがユーザーロケールのサブタグか (完全一致優先)
 * 2. lookup: ユーザーロケールを縮小してマッチ
 * 3. 言語コードが "en" にマッチする VC
 * 4. 配列の最初の要素
 *
 * `group` オプションを指定するとグループごとに 1 件ずつ選択した配列を返します
 *
 * @param items VC または VC ラッパー配列
 * @param options 選択オプション
 * @returns `group` なしの場合は選択された 1 件 (または undefined)、`group` ありの場合は配列
 */
export function selectByLocale<T extends LangSource>(items: T[]): T | undefined;
export function selectByLocale<T>(
  items: T[],
  options: SelectByLocaleOptions<T> & { group: (item: T) => string },
): T[];
export function selectByLocale<T>(
  items: T[],
  options: SelectByLocaleOptions<T> & { group?: undefined },
): T | undefined;
export function selectByLocale<T>(
  items: T[],
  options: SelectByLocaleOptions<T> = {},
): T | T[] | undefined {
  const getLangSource = options.getLangSource ?? defaultGetLangSource;

  if (options.group) {
    return Map.groupBy(items, options.group)
      .values()
      .flatMap((group) => {
        const selected = selectOne(group, getLangSource);
        return selected ? [selected] : [];
      })
      .toArray();
  }
  return selectOne(items, getLangSource);
}
