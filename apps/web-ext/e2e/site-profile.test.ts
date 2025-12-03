import { expect, popup, test as base } from "./fixtures";
import { test as siteProfileTest } from "./site-profile-fixtures";
import { test as staticHtmlTest } from "./static-html-fixtures";
import privateKey from "./account-key.example.priv.json" with { type: "json" };
import publicKey from "./account-key.example.pub.json" with { type: "json" };
import { mergeTests } from "@playwright/test";

const test = mergeTests(base, siteProfileTest, staticHtmlTest).extend({});

test("Site Profile を取得検証できる", async ({
  context,
  page,
  validSiteProfile,
  credentialsMissingPage,
}) => {
  await validSiteProfile(
    { privateKey, publicKey },
    credentialsMissingPage.issuer,
  );
  await page.goto(credentialsMissingPage.endpoint);
  const ext = await popup(context);
  await expect(ext?.getByTestId("site-profile")).toBeVisible();
  expect(await ext?.getByTestId("site-profile-wsp-name").innerText()).toBe(
    "SiteProfileの取得検証",
  );
});

test("Site Profile のビジュアルリグレッションテスト", async ({
  context,
  page,
  validSiteProfile,
  credentialsMissingPage,
}) => {
  test.skip(!process.env.CI, "VRT is only run in CI");

  await validSiteProfile(
    { privateKey, publicKey },
    credentialsMissingPage.issuer,
  );
  await page.goto(credentialsMissingPage.endpoint);
  const ext = await popup(context);

  // Visual Regression Test: ポップアップUIのスクリーンショット比較
  await expect(ext).toHaveScreenshot("site-profile-popup.png");
});
test("Site Profile を取得検証できるが、WMP が存在しない", async ({
  context,
  page,
  missingMediaSiteProfile,
  credentialsMissingPage,
}) => {
  await missingMediaSiteProfile(
    { privateKey, publicKey },
    credentialsMissingPage.issuer,
  );
  await page.goto(credentialsMissingPage.endpoint);
  const ext = await popup(context);
  await expect(ext?.getByTestId("site-profile")).toBeVisible();
  expect(await ext?.getByTestId("web-media-profile-missing").innerText()).toBe(
    "このサイト運営者に対応する組織情報を正しく読み取れませんでした",
  );
});
