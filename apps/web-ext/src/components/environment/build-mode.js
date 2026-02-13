// @ts-check

/**
 * ビルドモードプレフィックス付きフォーマット
 * @example formatBuildModeTitle("testing", "App") // "[TESTING] App"
 * @example formatBuildModeTitle("production", "App") // "App"
 * @param {string} mode
 * @param {string} title
 * @returns {string}
 */
export function formatBuildModeTitle(mode, title) {
  return mode === "production" ? title : `[${mode.toUpperCase()}] ${title}`;
}

/**
 * ビルドモードに応じてメッセージをフォーマット
 * @example formatBuildMode("testing") // "⚠️ Testing Build ⚠️"
 * @example formatBuildMode("testing", "App") // "⚠️ App (Testing Build) ⚠️"
 * @example formatBuildMode("production", "App") // "App"
 * @param {string} mode
 * @param {string} [message=""]
 * @returns {string}
 */
export function formatBuildMode(mode, message = "") {
  if (mode === "production") {
    return message;
  }

  const label = `${mode.charAt(0).toUpperCase()}${mode.slice(1)} Build`;
  return `⚠️ ${message ? `${message} (${label})` : label} ⚠️`;
}
