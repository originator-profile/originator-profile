import { expect, test } from "@wordpress/e2e-test-utils-playwright";

test("除外設定の保存・判定・入力検証とCSRF保護", async ({ page }) => {
  const settingsUrl = "/wp-admin/options-general.php?page=ca-manager";
  await page.goto(settingsUrl);
  const rules = page.getByLabel("除外するURL・パターン（1行に1件）", {
    exact: true,
  });
  const original = await rules.inputValue();
  const save = async (value: string) => {
    await rules.fill(value);
    await page.getByRole("button", { name: "除外設定を保存" }).click();
    await expect(rules).toBeVisible();
  };
  const check = async (url: string, excluded: boolean) => {
    await page.getByLabel("判定する公開URL（パーマリンク）").fill(url);
    await page.getByRole("button", { name: "URLを判定", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(
      excluded ? "除外対象です。" : "除外対象ではありません。",
    );
  };
  try {
    await test.step("CAサーバー設定とは独立してルールを保存できる", async () => {
      await save(
        "  /blog/*  \n\n/deep/**\n/?p=123\n/encoded/%E6%97%A5\n/blog/*",
      );
      await expect(rules).toHaveValue(
        "/blog/*\n/deep/**\n/?p=123\n/encoded/%E6%97%A5",
      );
      await page.reload();
      await expect(rules).toHaveValue(
        "/blog/*\n/deep/**\n/?p=123\n/encoded/%E6%97%A5",
      );
    });
    await test.step("階層・末尾スラッシュ・大文字小文字・クエリを判定できる", async () => {
      await check("http://localhost:9000/blog/a/", true);
      await check("https://例え.jp/blog/a/", true);
      await check("http://localhost:9000/blog/a/b", false);
      await check("http://localhost:9000/deep/a/b", true);
      await check("http://localhost:9000/Blog/a", false);
      await check("http://localhost:9000/?p=123", true);
      await check("http://localhost:9000/?p=456", false);
      await check("http://localhost:9000/encoded/%E6%97%A5", true);
    });
    await test.step("不正入力で保存済みルールが消えない", async () => {
      await save("not-a-path");
      await expect(
        page.getByText(/保存済みの除外設定を維持しました/).first(),
      ).toBeVisible();
      await expect(rules).toHaveValue(
        "/blog/*\n/deep/**\n/?p=123\n/encoded/%E6%97%A5",
      );
    });
    await test.step("nonceのない判定リクエストを拒否する", async () => {
      const response = await page.request.post(settingsUrl, {
        form: { profile_ca_check_url: "http://localhost:9000/blog/a" },
      });
      expect(response.status()).toBe(403);
      await page.goto(settingsUrl);
      await expect(rules).toHaveValue(
        "/blog/*\n/deep/**\n/?p=123\n/encoded/%E6%97%A5",
      );
    });
    await test.step("空設定で除外を解除できる", async () => {
      await save("");
      await check("http://localhost:9000/blog/a", false);
      await check("https://例え.jp/?p=1", false);
    });
  } finally {
    await page.goto(settingsUrl);
    await save(original);
  }
});
