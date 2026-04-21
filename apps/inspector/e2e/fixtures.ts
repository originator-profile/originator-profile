import { test as base, type BrowserContext, Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import util from "node:util";

const sleep = util.promisify(setTimeout);

// moduleだと __dirname が使えないので代わりを用意
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const test = base.extend<{
  context: BrowserContext;
}>({
  context: async ({ browser }, use) => {
    const extensionPath = path.resolve(
      __dirname,
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

export async function popup(ctx: BrowserContext): Promise<Page> {
  let [backgroundWorker] = ctx.serviceWorkers();
  if (!backgroundWorker) {
    // backgroundWorker がまだない場合、新しい Service Worker が作られるのを待つ。
    backgroundWorker = await ctx.waitForEvent("serviceworker");
    // worker が立ち上がった直後は chrome.tabs API が使えないことがあるので待つ。
    await sleep(500);
  }
  await backgroundWorker.evaluate(async function () {
    // 現在 active なタブの上で拡張機能のアイコンを押して起動する。
    const [targetTab] = await chrome.tabs.query({ active: true });
    // @ts-expect-error dispatch が未定義だが実際には存在する
    chrome.action.onClicked.dispatch(targetTab);
  });
  // NOTE: wait for popup to be opened
  await sleep(1_000);
  // @ts-expect-error assert that popup is opened
  const page: Page = ctx.pages().at(-1);
  return page;
}
