import { mergeTests } from "@playwright/test";
import { test as base, expect, popup } from "./fixtures";
import { test as siteProfileTest } from "./site-profile-fixtures";
import { test as staticHtmlTest } from "./static-html-fixtures";

const test = mergeTests(base, siteProfileTest, staticHtmlTest).extend({});

test("Site Profile の検証にした場合閲覧禁止ページが表示されるか", async ({
  context,
  page,
  invalidSiteProfile: _invalidSiteProfile,
  credentialsMissingPage,
}) => {
  await page.goto(credentialsMissingPage.endpoint);
  const ext = await popup(context);
  await expect(ext?.getByTestId("p-elm-prohibition-message")).toBeVisible();
});
