import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";

interface LanguageBackup {
  originalLanguages?: string;
}

// ブラウザの言語設定を削除
function deleteLanguageSetting(browser: "chromium" | "chrome"): void {
  const domain =
    browser === "chromium" ? "org.chromium.Chromium" : "com.google.Chrome";
  const browserName = browser === "chromium" ? "Chromium" : "Chrome";

  execSync(`defaults delete ${domain} AppleLanguages 2>/dev/null`);
  console.log(`${browserName}の言語設定を削除しました（元の状態に復元）`);
}

// ブラウザの言語設定を復元
function restoreLanguageSetting(
  browser: "chromium" | "chrome",
  originalLanguages: string,
): void {
  const domain =
    browser === "chromium" ? "org.chromium.Chromium" : "com.google.Chrome";
  const browserName = browser === "chromium" ? "Chromium" : "Chrome";

  execSync(`defaults write ${domain} AppleLanguages '${originalLanguages}'`);
  console.log(`${browserName}の言語設定を復元しました`);
}

// バックアップファイルから設定を復元
function restoreBrowserLanguage(
  browser: "chromium" | "chrome",
  tempDir: string,
): void {
  const backupFile = join(tempDir, `${browser}-language-backup.json`);

  if (!existsSync(backupFile)) {
    return;
  }

  const backup: LanguageBackup = JSON.parse(readFileSync(backupFile, "utf-8"));

  if (backup.originalLanguages === undefined) {
    deleteLanguageSetting(browser);
  } else {
    restoreLanguageSetting(browser, backup.originalLanguages);
  }
}

async function globalTeardown() {
  if (platform() !== "darwin") {
    return;
  }

  console.log("E2Eテスト終了。言語設定を復元します...");

  const tempDir = join(process.cwd(), ".e2e-temp");

  try {
    restoreBrowserLanguage("chromium", tempDir);
    restoreBrowserLanguage("chrome", tempDir);

    // 一時ファイルをクリーンアップ
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\
言語設定の復元に失敗しました: ${errorMessage}
手動で設定を確認してください。
確認コマンド: 
  defaults read org.chromium.Chromium AppleLanguages
`);
  }
}

export default globalTeardown;
