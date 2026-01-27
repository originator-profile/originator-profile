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
  await page.goto(credentialsPage.endpoint);

  // バッジ更新のデバウンス + 検証処理を待つ
  await page.waitForTimeout(1000);

  let [backgroundWorker] = context.serviceWorkers();
  if (!backgroundWorker) {
    backgroundWorker = await context.waitForEvent("serviceworker");
  }
  const badgeText = await backgroundWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true });
    if (!tab?.id) return "";
    return chrome.action.getBadgeText({ tabId: tab.id });
  });

  expect(badgeText).toBe("1");
});

test("クレデンシャルが存在しないページでバッジが表示されない", async ({
  context,
  page,
  missingSiteProfile: _missingSiteProfile,
  missingCredentials: _missingCredentials,
  credentialsPage,
}) => {
  await page.goto(credentialsPage.endpoint);

  // バッジ更新のデバウンス + 検証処理を待つ
  await page.waitForTimeout(1000);

  let [backgroundWorker] = context.serviceWorkers();
  if (!backgroundWorker) {
    backgroundWorker = await context.waitForEvent("serviceworker");
  }
  const badgeText = await backgroundWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true });
    if (!tab?.id) return "";
    return chrome.action.getBadgeText({ tabId: tab.id });
  });

  expect(badgeText).toBe("");
});
