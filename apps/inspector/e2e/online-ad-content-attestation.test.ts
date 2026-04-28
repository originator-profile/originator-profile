import { mergeTests } from "@playwright/test";
import privateKey from "./account-key.example.priv.json" with { type: "json" };
import publicKey from "./account-key.example.pub.json" with { type: "json" };
import { test as credentialsTest } from "./credentials-fixtures";
import { test as base, expect, sidepanel } from "./fixtures";
import { test as siteProfileTest } from "./site-profile-fixtures";
import { test as staticHtmlTest } from "./static-html-fixtures";

const test = mergeTests(
  base,
  siteProfileTest,
  staticHtmlTest,
  credentialsTest,
).extend({});

test("OnlineAd Content Attestation の表示が正しく行われていることを確認", async ({
  context,
  page,
  validOps,
  validCas,
  onlineAdPage,
}) => {
  await validOps({ publicKey, privateKey }, onlineAdPage.issuer);

  // OnlineAd Content Attestationを署名
  await validCas(
    { privateKey },
    onlineAdPage.contents,
    onlineAdPage.issuer,
    "OnlineAd",
  );

  // ページに遷移
  await page.goto(onlineAdPage.endpoint);
  const ext = await sidepanel(context);

  // 拡張機能の表示が正しいことを確認
  await expect(ext.getByTestId("cas")).toBeVisible();
  await expect(
    ext.getByRole("paragraph").getByText("テスト広告タイトル"),
  ).toBeVisible();
  await expect(
    ext.getByText("テスト広告の説明文").filter({ visible: true }),
  ).toBeVisible();

  // オーバーレイ表示の確認
  const highlightFrame = page.frameLocator("iframe");
  expect(await highlightFrame.getByTestId("content-highlight").count()).toEqual(
    1,
  );
});
