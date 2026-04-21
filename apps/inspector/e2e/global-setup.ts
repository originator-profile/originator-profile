import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";

// 現在のブラウザ言語設定を取得
function getCurrentLanguage(
  browser: "chromium" | "chrome",
): string | undefined {
  const domain =
    browser === "chromium" ? "org.chromium.Chromium" : "com.google.Chrome";
  try {
    return execSync(`defaults read ${domain} AppleLanguages 2>/dev/null`)
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

// ブラウザの言語設定を変更
function setLanguage(browser: "chromium" | "chrome", locale: string): void {
  const domain =
    browser === "chromium" ? "org.chromium.Chromium" : "com.google.Chrome";
  execSync(`defaults write ${domain} AppleLanguages '("${locale}")'`);
}

// バックアップファイルを保存
function saveBackup(
  browser: "chromium" | "chrome",
  currentLanguages: string | undefined,
): void {
  const tempDir = join(process.cwd(), ".e2e-temp");
  mkdirSync(tempDir, { recursive: true });

  const backupFile = join(tempDir, `${browser}-language-backup.json`);
  writeFileSync(
    backupFile,
    JSON.stringify({ originalLanguages: currentLanguages }),
  );
}

// ブラウザの言語設定をセットアップ
function setupBrowserLanguage(
  browser: "chromium" | "chrome",
  targetLocale: string,
): void {
  const browserName = browser === "chromium" ? "Chromium" : "Chrome";

  const currentLanguages = getCurrentLanguage(browser);
  console.log(
    `現在の${browserName}言語設定:`,
    currentLanguages || "なし（システムデフォルト）",
  );

  saveBackup(browser, currentLanguages);
  setLanguage(browser, targetLocale);

  const newLanguages = getCurrentLanguage(browser);
  console.log(
    `${browserName}の言語設定を${targetLocale}に変更しました:`,
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

  setupBrowserLanguage("chromium", targetLocale);
  setupBrowserLanguage("chrome", targetLocale);
}

export default globalSetup;
