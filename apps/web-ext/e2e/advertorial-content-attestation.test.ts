import { expect, popup, test as base } from "./fixtures";
import { test as siteProfileTest } from "./site-profile-fixtures";
import { test as staticHtmlTest } from "./static-html-fixtures";
import { test as credentialsTest } from "./credentials-fixtures";
import { mergeTests } from "@playwright/test";
import privateKey from "./account-key.example.priv.json" with { type: "json" };
import publicKey from "./account-key.example.pub.json" with { type: "json" };

const test = mergeTests(
  base,
  siteProfileTest,
  staticHtmlTest,
  credentialsTest,
).extend({});

test("Advertorial Content Attestation の表示が正しく行われていることを確認", async ({
  context,
  page,
  validOps,
  validCas,
  credentialsPage,
}) => {
  await validOps({ publicKey, privateKey }, credentialsPage.issuer);

  await validCas(
    { privateKey },
    credentialsPage.contents,
    credentialsPage.issuer,
    "Advertorial",
  );

  await page.goto(credentialsPage.endpoint);
  const ext = await popup(context);

  await expect(ext.getByTestId("cas")).toBeVisible();
  await expect(
    ext.getByRole("paragraph").getByText("<記事広告のタイトル>"),
  ).toBeVisible();
  await expect(
    ext.getByText("<記事広告の説明>").filter({ visible: true }),
  ).toBeVisible();
});
