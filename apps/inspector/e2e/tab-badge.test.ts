import { mergeTests } from "@playwright/test";
import privateKey from "./account-key.example.priv.json" with { type: "json" };
import publicKey from "./account-key.example.pub.json" with { type: "json" };
import { test as credentialsTest } from "./credentials-fixtures";
import { test as base, expect } from "./fixtures";
import { test as siteProfileTest } from "./site-profile-fixtures";
import { test as staticHtmlTest } from "./static-html-fixtures";

const test = mergeTests(
  base,
  siteProfileTest,
  staticHtmlTest,
  credentialsTest,
).extend({});

test("クレデンシャルが存在するページでバッジに正しい数値が表示される", async ({
  context,
  page,
  missingSiteProfile: _missingSiteProfile,
  credentialsPage,
  validCredentials,
}) => {
  await validCredentials(
    { publicKey, privateKey },
    credentialsPage.contents,
    credentialsPage.issuer,
  );

  // service workerを先に起動させる（別のページにアクセスしてトリガー）
  await page.goto("about:blank");

  let [backgroundWorker] = context.serviceWorkers();
  if (!backgroundWorker) {
    backgroundWorker = await context.waitForEvent("serviceworker");
  }

  // service workerの初期化を待つ
  await page.waitForTimeout(500);

  // 対象ページにナビゲート
  await page.goto(credentialsPage.endpoint);

  // バッジが期待値になるまでポーリングで待機
  /* eslint-disable no-await-in-loop -- Service Worker内で逐次ポーリングするため意図的 */
  const badgeText = await backgroundWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true });
    if (!tab?.id) throw new Error("No active tab");

    for (let i = 0; i < 30; i++) {
      const text = await chrome.action.getBadgeText({ tabId: tab.id });
      if (text !== "") return text;
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    }
    throw new Error("Timeout waiting for badge text");
  });
  /* eslint-enable no-await-in-loop */

  expect(badgeText).toBe("1");
});

test("クレデンシャルが存在しないページでバッジが表示されない", async ({
  context,
  page,
  missingSiteProfile: _missingSiteProfile,
  missingCredentials: _missingCredentials,
  credentialsPage,
}) => {
  // service workerを先に起動させる
  await page.goto("about:blank");

  let [backgroundWorker] = context.serviceWorkers();
  if (!backgroundWorker) {
    backgroundWorker = await context.waitForEvent("serviceworker");
  }

  // service workerの初期化を待つ
  await page.waitForTimeout(500);

  // 対象ページにナビゲート
  await page.goto(credentialsPage.endpoint);

  // バッジ更新のデバウンス + 検証処理を待つ
  await page.waitForTimeout(1000);

  const badgeText = await backgroundWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true });
    if (!tab?.id) return "";
    return chrome.action.getBadgeText({ tabId: tab.id });
  });

  expect(badgeText).toBe("");
});
