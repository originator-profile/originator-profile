import type { Page } from "@playwright/test";
import { expect, test } from "@wordpress/e2e-test-utils-playwright";

// 設定の復元に失敗したことを再試行で隠さない。
test.describe.configure({ retries: 0 });

const settingsUrl = "/wp-admin/options-general.php?page=ca-manager";
const fields = [
  "profile_ca_issuer_id",
  "profile_ca_server_hostname",
  "profile_ca_server_admin_secret",
] as const;
type Settings = Record<(typeof fields)[number], string>;

const field = (page: Page, name: string) => page.locator(`[name="${name}"]`);
const notice = (page: Page) => page.locator("#profile-ca-settings-check");

async function save(page: Page, settings: Settings) {
  await page.goto(settingsUrl);
  // 並列に入力すると入力欄の間で文字が混ざるため、1欄ずつ入力する。
  await field(page, "profile_ca_issuer_id").fill(settings.profile_ca_issuer_id);
  await field(page, "profile_ca_server_hostname").fill(
    settings.profile_ca_server_hostname,
  );
  await field(page, "profile_ca_server_admin_secret").fill(
    settings.profile_ca_server_admin_secret,
  );
  await page.locator("#profile-ca-settings [type=submit]").click();
  // 管理画面の JavaScript が URL から settings-updated を取り除くため、保存完了の通知で待つ。
  await expect(page.locator("#setting-error-settings_updated")).toBeVisible();
}

let original: Settings | undefined;

test.beforeEach(async ({ page }) => {
  original = undefined;
  await page.goto(settingsUrl);
  const values = await Promise.all(
    fields.map((name) => field(page, name).inputValue()),
  );
  original = Object.fromEntries(
    fields.map((name, i) => [name, values[i]]),
  ) as Settings;
});

test.afterEach(async ({ page }) => {
  if (!original) {
    return;
  }
  await save(page, original);
  await page.goto(settingsUrl);
  await expect(field(page, "profile_ca_issuer_id")).toHaveValue(
    original.profile_ca_issuer_id,
  );
  await expect(field(page, "profile_ca_server_hostname")).toHaveValue(
    original.profile_ca_server_hostname,
  );
  await expect(field(page, "profile_ca_server_admin_secret")).toHaveValue(
    original.profile_ca_server_admin_secret,
  );
});

test("保存した設定の形式に問題があれば警告する", async ({ page }) => {
  const valid: Settings = {
    profile_ca_issuer_id: "dns:media.example.com",
    profile_ca_server_hostname: "playground.originator-profile.org",
    profile_ca_server_admin_secret: "user:password",
  };
  await save(page, valid);
  await expect(notice(page)).toHaveCount(0);

  await save(page, {
    ...valid,
    profile_ca_server_hostname: "https://playground.originator-profile.org/",
    profile_ca_server_admin_secret: "password-only",
  });
  await expect(notice(page)).toContainText("保存した設定に問題があります。");
  await expect(notice(page).locator("li")).toHaveText([
    /「https:\/\/」やパスを付けず/,
    /「ユーザー名:パスワード」の形式/,
  ]);

  // 保存直後の画面でだけ表示する。
  await page.goto(settingsUrl);
  await expect(notice(page)).toHaveCount(0);
});
