import { mergeTests } from "@playwright/test";
import privateKey from "./account-key.example.priv.json" with { type: "json" };
import publicKey from "./account-key.example.pub.json" with { type: "json" };
import { test as credentialsTest } from "./credentials-fixtures";
import { test as base, expect, sidepanel } from "./fixtures";
import { test as siteProfileTest } from "./site-profile-fixtures";
import { test as staticHtmlTest } from "./static-html-fixtures";

const test = mergeTests(
  base,
  siteProfileTest,
  staticHtmlTest,
  credentialsTest,
).extend({});

test("拡張機能画面での認証および対象ページのオーバーレイ表示ができているか", async ({
  context,
  page,
  validSiteProfile,
  validCredentials,
  credentialsPage,
}) => {
  const key = { privateKey, publicKey };
  await validSiteProfile(key, credentialsPage.issuer);
  await validCredentials(key, credentialsPage.contents, credentialsPage.issuer);
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);

  await expect(ext.getByTestId("site-profile")).toBeVisible();
  expect(
    await ext
      .getByText("このメインコンテンツは次の組織が発信しています")
      .count(),
  ).toEqual(1);

  // ハイライトはiframe内に存在するためまずはiframeを取得してその中から検索する
  const highlightFrame = page.frameLocator("iframe");
  expect(await highlightFrame.getByTestId("content-highlight").count()).toEqual(
    1,
  );
});
