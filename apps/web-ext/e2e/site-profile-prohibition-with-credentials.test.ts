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
  credentialsTest,
  staticHtmlTest,
).extend({});

test("CAS/OPSの取得に成功するがSPの検証に失敗した場合閲覧禁止", async ({
  context,
  page,
  invalidSiteProfile: _invalidSiteProfile,
  validCredentials,
  credentialsPage,
}) => {
  await validCredentials(
    { publicKey, privateKey },
    credentialsPage.contents,
    credentialsPage.issuer,
  );
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("p-elm-prohibition-message")).toBeVisible();

  await expect(
    ext.getByText("正規のコンテンツではない可能性があります"),
  ).toHaveCount(1);
  await expect(
    ext.getByText(
      "発信者の詐称やコンテンツの改竄（かいざん）がされている可能性があります",
    ),
  ).toHaveCount(1);

  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "cancel");
  await expectStatus(ext, "originator-profile-set-top", "check");
  await expectStatus(ext, "content-attestation-set", "check");
  await expectStatus(ext, "core-profile", "cancel");
  await expectStatus(ext, "profile-annotation", "cancel");
  await expectStatus(ext, "web-media-profile", "cancel");
});
test("CAの署名がその発行者のSPで配布される検証鍵を使って検証できない場合閲覧禁止", async ({
  context,
  page,
  validSiteProfile,
  missingOps: _,
  evilCas: evilCas,
  credentialsPage,
}) => {
  await evilCas(credentialsPage.contents, credentialsPage.issuer);
  await validSiteProfile({ privateKey, publicKey }, credentialsPage.issuer);
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("p-elm-prohibition-message")).toBeVisible();

  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "check");
  await expectStatus(ext, "originator-profile-set-top", "null");
  await expectStatus(ext, "content-attestation-set", "cancel");
});
test("SPの署名がその発行者のOPで配布される検証鍵を使って検証できない場合閲覧禁止", async ({
  context,
  page,
  evilSiteProfile,
  missingOps: _,
  validCas: validCas,
  credentialsPage,
}) => {
  await validCas(
    { privateKey },
    credentialsPage.contents,
    credentialsPage.issuer,
  );
  await evilSiteProfile({ publicKey }, credentialsPage.issuer);
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("p-elm-prohibition-message")).toBeVisible();

  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "cancel");
  await expectStatus(ext, "originator-profile-set-top", "check");
  await expectStatus(ext, "content-attestation-set", "check");
  await expectStatus(ext, "core-profile", "cancel");
  await expectStatus(ext, "profile-annotation", "cancel");
  await expectStatus(ext, "web-media-profile", "cancel");
});
test("SPとCAの署名がその発行者のOPまたはSPで配布される検証鍵を使って検証できない場合閲覧禁止", async ({
  context,
  page,
  evilSiteProfile,
  missingOps: _,
  evilCas: evilCas,
  credentialsPage,
}) => {
  await evilCas(credentialsPage.contents, credentialsPage.issuer);
  await evilSiteProfile({ publicKey }, credentialsPage.issuer);
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("p-elm-prohibition-message")).toBeVisible();

  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "cancel");
  await expectStatus(ext, "originator-profile-set-top", "null");
  await expectStatus(ext, "content-attestation-set", "cancel");
  await expectStatus(ext, "core-profile", "cancel");
  await expectStatus(ext, "profile-annotation", "cancel");
  await expectStatus(ext, "web-media-profile", "cancel");
});
