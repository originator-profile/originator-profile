import { generateKey } from "@originator-profile/cryptography";
import { mergeTests } from "@playwright/test";
import privateKey from "./account-key.example.priv.json" with { type: "json" };
import publicKey from "./account-key.example.pub.json" with { type: "json" };
import { test as credentialsTest } from "./credentials-fixtures";
import { test as base, expect, popup } from "./fixtures";
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

  const ext = await popup(context);
  await expect(ext?.getByTestId("p-elm-prohibition-message")).toBeVisible();
});
