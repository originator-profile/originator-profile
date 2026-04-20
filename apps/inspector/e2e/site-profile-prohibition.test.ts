import { mergeTests } from "@playwright/test";
import { expectStatus } from "./expect-status";
import { test as base, expect, sidepanel } from "./fixtures";
import { gotoDetailPage } from "./goto-detail-page";
import { test as siteProfileTest } from "./site-profile-fixtures";
import { test as staticHtmlTest } from "./static-html-fixtures";

const test = mergeTests(base, siteProfileTest, staticHtmlTest).extend({});

test("Site Profile の検証に失敗した場合閲覧禁止ページが表示されるか", async ({
  context,
  page,
  invalidSiteProfile: _invalidSiteProfile,
  credentialsMissingPage,
}) => {
  await page.goto(credentialsMissingPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("p-elm-prohibition-message")).toBeVisible();

  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "cancel");
  await expectStatus(ext, "core-profile", "cancel");
  await expectStatus(ext, "profile-annotation", "cancel");
  await expectStatus(ext, "web-media-profile", "cancel");
});
