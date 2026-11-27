import { mergeTests, type BrowserContext } from "@playwright/test";
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

/** Service Worker を起動させてから得る */
async function backgroundWorkerOf(context: BrowserContext) {
  const [worker] = context.serviceWorkers();
  return worker ?? context.waitForEvent("serviceworker");
}

/** アクティブなタブのランチャーアイコンのツールチップ */
async function launcherTitleOf(context: BrowserContext) {
  const worker = await backgroundWorkerOf(context);
  return worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true });
    return tab?.id === undefined
      ? ""
      : chrome.action.getTitle({ tabId: tab.id });
  });
}

test("Site Profile とメインのコンテンツを確認できれば、両方を確認できることを示す", async ({
  context,
  page,
  validSiteProfile,
  validCredentials,
  credentialsPage,
}) => {
  await validSiteProfile(
    { privateKey, publicKey },
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  await validCredentials(
    { privateKey, publicKey },
    credentialsPage.contents,
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  await page.goto(credentialsPage.endpoint);

  await expect
    .poll(() => launcherTitleOf(context))
    .toBe("サイト運営者とページ本体の出どころを確認できます");
});

test("メインのコンテンツだけを確認できれば、サイト運営者を確認できないことを示す", async ({
  context,
  page,
  missingSiteProfile: _,
  validCredentials,
  credentialsPage,
}) => {
  await validCredentials(
    { privateKey, publicKey },
    credentialsPage.contents,
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  await page.goto(credentialsPage.endpoint);

  await expect
    .poll(() => launcherTitleOf(context))
    .toBe("ページ本体の出どころを確認できます。サイト運営者は確認できません");
});

test("出どころの情報が無ければ、そのことを示す", async ({
  context,
  page,
  missingSiteProfile: _site,
  missingCredentials: _credentials,
  credentialsPage,
}) => {
  await page.goto(credentialsPage.endpoint);

  await expect
    .poll(() => launcherTitleOf(context))
    .toBe("このページには出どころの情報がありません");
});
