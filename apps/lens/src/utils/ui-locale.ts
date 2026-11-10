/**
 * 文言 (_locales) の解決に使われた言語の BCP 47 言語タグ
 *
 * NOTE: getUILanguage() はこれと食い違うことがある。オーバーレイの iframe は
 * ページの文脈で動き chrome.i18n を使えないため、navigator.language で代える
 */
export function uiLocale(): string {
  const locale = globalThis.chrome?.i18n?.getMessage("@@ui_locale");
  return locale ? locale.replaceAll("_", "-") : navigator.language;
}
