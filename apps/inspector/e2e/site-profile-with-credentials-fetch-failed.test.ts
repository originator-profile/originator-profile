import { mergeTests } from "@playwright/test";
import privateKey from "./account-key.example.priv.json" with { type: "json" };
import publicKey from "./account-key.example.pub.json" with { type: "json" };
import { test as crednetialsTest } from "./credentials-fixtures";
import { test as base, expect, sidepanel } from "./fixtures";
import { test as siteProfileTest } from "./site-profile-fixtures";
import { test as staticHtmlTest } from "./static-html-fixtures";

const test = mergeTests(base, siteProfileTest, crednetialsTest, staticHtmlTest);
test("SiteProfileは検証成功するが、OPS / CASの取得に失敗した時にSiteProfileの表示がされるか", async ({
  context,
  page,
  validSiteProfile,
  missingCredentials: _missingCredentials,
  credentialsPage,
}) => {
  await validSiteProfile({ publicKey, privateKey }, credentialsPage.issuer);
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext.getByTestId("site-profile")).toBeVisible();
  expect(await ext.getByTestId("site-profile-wsp-name").innerText()).toBe(
    "SiteProfileの取得検証",
  );

  await expect(ext.locator("main")).toHaveCount(0);
});
