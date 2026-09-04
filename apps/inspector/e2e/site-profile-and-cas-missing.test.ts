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

test("Site Profile と CAS が取得できない場合Unsuportedが表示されるか", async ({
  context,
  page,
  missingSiteProfile: _missingSiteProfile,
  missingCas: _missingCas,
  validOps,
  credentialsPage,
}) => {
  await validOps(
    { publicKey, privateKey },
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("p-elm-unsupported-message")).toBeVisible();
  await expect(
    ext.getByText("このWebページの発信者は未検証です。\nご注意ください"),
  ).toHaveCount(1);
  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "cancel");
  await expectStatus(ext, "content-attestation-set", "null");
});
