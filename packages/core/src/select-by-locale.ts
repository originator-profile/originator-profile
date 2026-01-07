/**
 * VCの@contextから@languageタグを取得
 * @param vc Verifiable Credential
 * @returns 言語コード (例: "ja", "en") または undefined
 */
function getLanguage(vc: { "@context": unknown }): string | undefined {
  const context = vc["@context"];
  if (!Array.isArray(context)) return undefined;

  for (const item of context) {
    if (typeof item === "object" && item !== null && "@language" in item) {
      const lang = item["@language"] as string;
      // 地域コードを含む場合は言語コードのみを返す (例: "ja-JP" → "ja")
      return lang.split("-")[0];
    }
  }
  return undefined;
}

/**
 * ユーザーロケールに基づいてVCを選択
 *
 * フォールバック優先順位:
 * 1. ユーザーのロケールに一致するVC
 * 2. 言語コードが "en" のVC
 * 3. 配列の最初の要素
 *
 * @param items VC配列
 * @returns 選択されたVC または undefined (配列が空の場合)
 */
export function selectByLocale<T extends { "@context": unknown }>(
  items: T[],
): T | undefined {
  if (items.length === 0) return undefined;
  if (items.length === 1) return items[0];

  // ユーザーロケール取得 (例: "ja-JP" → "ja")
  const userLocale =
    typeof navigator !== "undefined"
      ? navigator.language.split("-")[0]
      : "en";

  // 1. ユーザーロケールで検索
  const byLocale = items.find((item) => getLanguage(item) === userLocale);
  if (byLocale) return byLocale;

  // 2. 'en'にフォールバック
  const byEn = items.find((item) => getLanguage(item) === "en");
  if (byEn) return byEn;

  // 3. 最初の要素にフォールバック
  return items[0];
}
