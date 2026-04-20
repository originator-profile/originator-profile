import { test as base, expect } from "./fixtures";

const test = base.extend({});

const VERIFY_LINK_PAGE = "http://localhost:8080/examples/verify-link.html";
const HOME_PAGE = "http://localhost:8080/";

// i18n: ボタン・タイトルは日本語/英語どちらの可能性もある
const GO_BACK_TEXT = /Go back to previous page|前のページに戻る/;
const CLOSE_TAB_TEXT = /Close this tab|このタブを閉じる/;
const PROCEED_TEXT = /Proceed anyway|このままアクセスする/;
const WARNING_TITLE =
  /Unable to verify site identity|サイトの身元を確認できません/;
const DESTINATION_LABEL = /Destination:|遷移先:/;

/**
 * Warning ページが表示されるまで待機する
 */
async function waitForWarningPage(
  page: import("@playwright/test").Page,
  timeoutMs: number = 10_000,
) {
  await page.waitForURL((url) => url.hash.includes("#/warning"), {
    timeout: timeoutMs,
  });
}

/**
 * Service Worker の起動を待つ
 */
async function ensureServiceWorker(
  context: import("@playwright/test").BrowserContext,
  page: import("@playwright/test").Page,
) {
  if (context.serviceWorkers().length === 0) {
    await context.waitForEvent("serviceworker");
  }
  await page.waitForTimeout(1000);
}

test.describe("リンク検証", () => {
  test("同一タブ: Go back で広告クリック元ページに戻る", async ({
    context,
    page,
  }) => {
    // 1. home → verify-link へ遷移（履歴を2ページ作る）
    await page.goto(HOME_PAGE);
    await page.goto(VERIFY_LINK_PAGE);
    await ensureServiceWorker(context, page);

    // 2. iframe[2]「外部サイトへのリンク (OPID不一致)」のリンクをクリック
    const frame = page.frameLocator("iframe >> nth=2");
    await frame.locator("a").first().click();

    // 3. Warning ページが表示される
    await waitForWarningPage(page);

    // 4. "Go back" ボタンが表示されている
    const goBackButton = page.getByRole("button", { name: GO_BACK_TEXT });
    await expect(goBackButton).toBeVisible({ timeout: 5000 });

    // 5. Go Back をクリック
    await goBackButton.click();

    // 6. verify-link.html に戻る（home ではなく1つ前のページ）
    await page.waitForURL(
      (url) => url.href.includes("/examples/verify-link.html"),
      { timeout: 5000 },
    );
    expect(page.url()).toContain("/examples/verify-link.html");
  });

  test("新規タブ (window.open): Close Tab ボタンが表示される", async ({
    context,
    page,
  }) => {
    await page.goto(VERIFY_LINK_PAGE);
    await ensureServiceWorker(context, page);

    // iframe[3]「外部サイトへのリンク (OPID不一致) (window.open)」をクリック → 新規タブ
    const [newPage] = await Promise.all([
      context.waitForEvent("page"),
      page.frameLocator("iframe >> nth=3").locator("a").first().click(),
    ]);

    await waitForWarningPage(newPage);

    // "Close this tab" が表示されている
    const closeTabButton = newPage.getByRole("button", {
      name: CLOSE_TAB_TEXT,
    });
    await expect(closeTabButton).toBeVisible({ timeout: 5000 });

    // "Go back" は表示されていない
    const goBackButton = newPage.getByRole("button", { name: GO_BACK_TEXT });
    await expect(goBackButton).not.toBeVisible();
  });

  test("正常なケース: OPID一致時に Warning が表示されず正常遷移する", async ({
    context,
    page,
  }) => {
    await page.goto(VERIFY_LINK_PAGE);
    await ensureServiceWorker(context, page);

    // iframe[0]「正常なケース」のリンクをクリック（target="_top"で同タブ遷移）
    const frame = page.frameLocator("iframe >> nth=0");
    await frame.locator("a").first().click();

    // valid-dest.html に遷移する（Warning ではない）
    await page.waitForURL(
      (url) => url.href.includes("/examples/valid-dest.html"),
      { timeout: 10_000 },
    );
    expect(page.url()).toContain("/examples/valid-dest.html");

    // Warning ページのハッシュが含まれていないことを確認
    expect(page.url()).not.toContain("#/warning");
  });

  test("Warning → Proceed anyway で遷移先に進む", async ({ context, page }) => {
    await page.goto(VERIFY_LINK_PAGE);
    await ensureServiceWorker(context, page);

    // iframe[2]「外部サイトへのリンク (OPID不一致)」をクリック → Warning 表示
    const frame = page.frameLocator("iframe >> nth=2");
    await frame.locator("a").first().click();
    await waitForWarningPage(page);

    // "Proceed anyway" ボタンが表示され、有効になっていることを確認
    const proceedButton = page.getByRole("button", { name: PROCEED_TEXT });
    await expect(proceedButton).toBeVisible({ timeout: 5000 });
    await expect(proceedButton).toBeEnabled();

    // Proceed をクリック → 遷移先（example.com）へ進む
    await proceedButton.click();
    await page.waitForURL((url) => url.href.includes("example.com"), {
      timeout: 10_000,
    });
  });

  test("Warning ページに正しい情報が表示される", async ({ context, page }) => {
    await page.goto(VERIFY_LINK_PAGE);
    await ensureServiceWorker(context, page);

    // iframe[2]「外部サイトへのリンク (OPID不一致)」をクリック → Warning 表示
    const frame = page.frameLocator("iframe >> nth=2");
    await frame.locator("a").first().click();
    await waitForWarningPage(page);

    // 1. タイトルが表示されている
    await expect(page.getByText(WARNING_TITLE)).toBeVisible({ timeout: 5000 });

    // 2. 遷移先URL (https://example.com) が表示されている
    await expect(page.getByText("https://example.com")).toBeVisible();

    // 3. 遷移先ラベルが表示されている
    await expect(page.getByText(DESTINATION_LABEL)).toBeVisible();

    // 4. Go Back / Proceed ボタンが両方表示されている
    await expect(
      page.getByRole("button", { name: GO_BACK_TEXT }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: PROCEED_TEXT }),
    ).toBeVisible();
  });

  test("異常なケース (OPID不一致): Warning が表示される", async ({
    context,
    page,
  }) => {
    await page.goto(VERIFY_LINK_PAGE);
    await ensureServiceWorker(context, page);

    // iframe[4]「異常なケース」(dns:invalid.example.com) のリンクをクリック
    const frame = page.frameLocator("iframe >> nth=4");
    await frame.locator("a").first().click();

    // Warning ページが表示される
    await waitForWarningPage(page);

    // タイトルが表示されている
    await expect(page.getByText(WARNING_TITLE)).toBeVisible({ timeout: 5000 });

    // Go Back / Proceed ボタンが両方表示されている
    await expect(
      page.getByRole("button", { name: GO_BACK_TEXT }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: PROCEED_TEXT }),
    ).toBeVisible();
  });
});
