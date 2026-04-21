/** macOS の `defaults write` で言語設定を書き込む対象ドメイン */
export const BROWSER_DOMAINS = [
  "org.chromium.Chromium",
  "com.google.Chrome",
  "com.google.chrome.for.testing",
] as const;

export type BrowserDomain = (typeof BROWSER_DOMAINS)[number];
