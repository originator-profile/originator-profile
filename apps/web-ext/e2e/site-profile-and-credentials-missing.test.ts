import { mergeTests } from "@playwright/test";
import { test as credentialsTest } from "./credentials-fixtures";
import { expectStatus } from "./expect-status";
import { test as base, expect, sidepanel } from "./fixtures";
import { gotoDetailPage } from "./goto-detail-page";
import { test as siteProfileTest } from "./site-profile-fixtures";
import { test as staticHtmlTest } from "./static-html-fixtures";

const test = mergeTests(base, siteProfileTest, staticHtmlTest, credentialsTest);
test("Site Profile と OPS/CAS が取得できない場合非サポートが表示されるか", async ({
  context,
  page,
  missingSiteProfile: _missingSiteProfile,
  missingCredentials: _missingCredentials,
  credentialsPage,
}) => {
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("p-elm-unsupported-message")).toBeVisible();
  await expect(
    ext.getByText(
      "このWebページの発信者は\nサイト運営者にお問い合わせください",
    ),
  ).toHaveCount(1);

  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "cancel");
  await expectStatus(ext, "originator-profile-set-top", "check");
  await expectStatus(ext, "content-attestation-set", "null");
});
