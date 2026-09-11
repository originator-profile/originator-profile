import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";

import { type BrowserDomain, BROWSER_DOMAINS } from "./browser-domains";

interface LanguageBackup {
  originalLanguages?: string;
}

// ブラウザの言語設定を削除
function deleteLanguageSetting(domain: BrowserDomain): void {
  execSync(`defaults delete ${domain} AppleLanguages 2>/dev/null`);
  console.log(`${domain}の言語設定を削除しました（元の状態に復元）`);
}

// ブラウザの言語設定を復元
function restoreLanguageSetting(
  domain: BrowserDomain,
  originalLanguages: string,
): void {
  execSync(`defaults write ${domain} AppleLanguages '${originalLanguages}'`);
  console.log(`${domain}の言語設定を復元しました`);
}

// バックアップファイルから設定を復元
function restoreBrowserLanguage(domain: BrowserDomain, tempDir: string): void {
  const backupFile = join(tempDir, `${domain}-language-backup.json`);

  if (!existsSync(backupFile)) {
    return;
  }

  const backup: LanguageBackup = JSON.parse(readFileSync(backupFile, "utf-8"));

  if (backup.originalLanguages === undefined) {
    deleteLanguageSetting(domain);
  } else {
    restoreLanguageSetting(domain, backup.originalLanguages);
  }
}

async function globalTeardown() {
  if (platform() !== "darwin") {
    return;
  }

  console.log("E2Eテスト終了。言語設定を復元します...");

  const tempDir = join(process.cwd(), ".e2e-temp");

  try {
    for (const domain of BROWSER_DOMAINS) {
      restoreBrowserLanguage(domain, tempDir);
    }

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
${BROWSER_DOMAINS.map((d) => `  defaults read ${d} AppleLanguages`).join("\n")}
`);
  }
}

export default globalTeardown;
