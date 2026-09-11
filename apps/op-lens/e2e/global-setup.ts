import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";

import { type BrowserDomain, BROWSER_DOMAINS } from "./browser-domains";

// 現在のブラウザ言語設定を取得
function getCurrentLanguage(domain: BrowserDomain): string | undefined {
  try {
    return execSync(`defaults read ${domain} AppleLanguages 2>/dev/null`)
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

// ブラウザの言語設定を変更
function setLanguage(domain: BrowserDomain, locale: string): void {
  execSync(`defaults write ${domain} AppleLanguages '("${locale}")'`);
}

// バックアップファイルを保存
function saveBackup(
  domain: BrowserDomain,
  currentLanguages: string | undefined,
): void {
  const tempDir = join(process.cwd(), ".e2e-temp");
  mkdirSync(tempDir, { recursive: true });

  const backupFile = join(tempDir, `${domain}-language-backup.json`);
  writeFileSync(
    backupFile,
    JSON.stringify({ originalLanguages: currentLanguages }),
  );
}

// ブラウザの言語設定をセットアップ
function setupBrowserLanguage(
  domain: BrowserDomain,
  targetLocale: string,
): void {
  const currentLanguages = getCurrentLanguage(domain);
  console.log(
    `現在の${domain}言語設定:`,
    currentLanguages || "なし（システムデフォルト）",
  );

  saveBackup(domain, currentLanguages);
  setLanguage(domain, targetLocale);

  const newLanguages = getCurrentLanguage(domain);
  console.log(
    `${domain}の言語設定を${targetLocale}に変更しました:`,
    newLanguages,
  );
}

async function globalSetup() {
  if (platform() !== "darwin") {
    console.log(
      "Linux/CI環境を検出しました。環境変数LC_ALLで言語設定を制御します。",
    );
    return;
  }

  console.log("macOS環境を検出しました。E2Eテスト用に言語設定を調整します...");

  const targetLocale = navigator.language;
  console.log(
    `目標ロケール: ${targetLocale} (LC_ALL=${process.env.LC_ALL || "デフォルト"})`,
  );

  for (const domain of BROWSER_DOMAINS) {
    setupBrowserLanguage(domain, targetLocale);
  }
}

export default globalSetup;
