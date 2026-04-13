import { generateKey } from "@originator-profile/cryptography";
import { mergeTests } from "@playwright/test";
import privateKey from "./account-key.example.priv.json" with { type: "json" };
import publicKey from "./account-key.example.pub.json" with { type: "json" };
import { test as credentialsTest } from "./credentials-fixtures";
import { expectStatus } from "./expect-status";
import { test as base, expect, sidepanel } from "./fixtures";
import { gotoDetailPage } from "./goto-detail-page";
import { test as siteProfileTest } from "./site-profile-fixtures";
import { test as staticHtmlTest } from "./static-html-fixtures";

const test = mergeTests(
  base,
  siteProfileTest,
  staticHtmlTest,
  credentialsTest,
).extend({});

test("異なる鍵ペアによる署名のとき検証失敗", async ({
  context,
  page,
  validSiteProfile,
  credentialsPage,
  validCredentials,
}) => {
  await validSiteProfile({ privateKey, publicKey }, credentialsPage.issuer);
  const key = await generateKey();
  await validCredentials(key, credentialsPage.contents, credentialsPage.issuer);
  await page.goto(credentialsPage.endpoint);

  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("p-elm-prohibition-message")).toBeVisible();

  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "check");
  await expectStatus(ext, "originator-profile-set-top", "cancel");
  await expectStatus(ext, "content-attestation-set", "null");
  await expectStatus(ext, "core-profile", "cancel");
});
