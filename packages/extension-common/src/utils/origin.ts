/**
 * URL のオリジン
 * @param url URL
 * @returns オリジン。解釈できない URL では不透明なオリジン ("null")
 */
export function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "null";
  }
}
