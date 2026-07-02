import { mergeTests } from "@playwright/test";
import privateKey from "./account-key.example.priv.json" with { type: "json" };
import publicKey from "./account-key.example.pub.json" with { type: "json" };
import { expectStatus } from "./expect-status";
import { test as base, expect, sidepanel } from "./fixtures";
import { gotoDetailPage } from "./goto-detail-page";
import { test as siteProfileTest } from "./site-profile-fixtures";
import { test as staticHtmlTest } from "./static-html-fixtures";

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
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("site-profile")).toBeVisible();
  expect(await ext?.getByTestId("site-profile-wsp-name").innerText()).toBe(
    "SiteProfileの取得検証",
  );

  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "check");
  await ext?.getByTestId("result-site-profile").click();
  await ext?.getByTestId("result-originator-profile-set").click();
  await ext?.getByTestId("result-originator-profile-0").first().click();
  await ext?.getByTestId("result-core-profile").first().click();
  await expect(ext.getByTestId("issuer").first()).toBeVisible();
  await expect(ext.getByTestId("validity-period").first()).toBeVisible();
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
  const ext = await sidepanel(context);

  // Visual Regression Test: サイドパネルUIのスクリーンショット比較
  await expect(ext).toHaveScreenshot("site-profile-sidepanel.png");
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
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("site-profile")).toBeVisible();
  expect(await ext?.getByTestId("web-media-profile-missing").innerText()).toBe(
    "このサイト運営者に対応する組織情報を正しく読み取れませんでした",
  );

  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "check");
  await expect(ext?.getByTestId("result-web-media-profile")).toHaveCount(0);
});
test("Site Profile を取得検証できるが、有効期限が近く、詳細情報画面にて警告マークが表示される", async ({
  context,
  page,
  expiringSoonSiteProfile,
  credentialsMissingPage,
}) => {
  await expiringSoonSiteProfile(
    { privateKey, publicKey },
    credentialsMissingPage.issuer,
  );
  await page.goto(credentialsMissingPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("site-profile")).toBeVisible();

  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "check");
  await expect(
    ext
      .getByTestId("validity-period")
      .getByTestId("caution-validity-period")
      .first(),
  ).toBeVisible();
});

test("詳細情報画面に検証中の警告ログが表示される", async ({
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
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("site-profile")).toBeVisible();

  await gotoDetailPage(ext);
  // フィクスチャの WSP image には digestSRI が無いため警告が表示される
  await expect(ext.getByTestId("verification-warnings")).toContainText(
    "digestSRI is missing",
  );
});
