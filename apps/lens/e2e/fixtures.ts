import { test as base, type BrowserContext, Page } from "@playwright/test";
import path from "node:path";
import util from "node:util";

const sleep = util.promisify(setTimeout);

export const test = base.extend<{
  context: BrowserContext;
}>({
  context: async ({ browser }, use) => {
    const extensionPath = path.resolve(
      import.meta.dirname,
      `../dist-${browser.browserType().name()}`,
    );
    const context = await browser.browserType().launchPersistentContext("", {
      channel: "chromium",
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    await use(context);
    await context.close();
  },
  page: async ({ page }, use) => {
    await page.route(
      "http://localhost:8080/example-profile-set",
      async (route) =>
        route.fulfill({
          body: `
        <!doctype html>
        <html lang="ja">
        <head>
          <meta charset="utf-8">
          <title>Example Profile Set</title>
          <link
            href="/website/ef9d78e0-d81a-4e39-b7a0-27e15405edc7/profiles";
            rel="alternate"
            type="application/ld+json"
          />
        </head>
        <body><h1>OP 確認くん</h1></body>
      `,
          contentType: "text/html",
        }),
    );
    await use(page);
  },
});

export const expect = test.expect;

export async function sidepanel(ctx: BrowserContext): Promise<Page> {
  let [backgroundWorker] = ctx.serviceWorkers();
  if (!backgroundWorker) {
    // backgroundWorker がまだない場合、新しい Service Worker が作られるのを待つ。
    backgroundWorker = await ctx.waitForEvent("serviceworker");
    // worker が立ち上がった直後は chrome.tabs API が使えないことがあるので待つ。
    await sleep(500);
  }

  const extensionId = backgroundWorker.url().split("/")[2];

  // アクティブタブのIDを取得
  const tabId = await backgroundWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab?.id;
  });
  if (tabId === undefined) {
    throw new Error("No active tab found");
  }

  // サイドパネルの HTML を直接タブで開く（E2E テスト用）
  const url = `chrome-extension://${extensionId}/index.html#/tab/${tabId}`;
  const panelPage = await ctx.newPage();
  await panelPage.goto(url);

  // Loading 完了を待つ（全ページで GlobalHeader が表示される）
  await panelPage
    .getByTestId("global-header-menu-button")
    .waitFor({ state: "visible" });
  return panelPage;
}
