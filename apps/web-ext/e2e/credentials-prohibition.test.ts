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

test("CASの検証に失敗した場合に閲覧禁止が表示されるか", async ({
  context,
  page,
  missingSiteProfile: _missingSiteProfile,
  invalidCas: _invalidCas,
  validOps,
  credentialsPage,
}) => {
  await validOps({ publicKey, privateKey }, credentialsPage.issuer);
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("p-elm-prohibition-message")).toBeVisible();

  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "cancel");
  await expectStatus(ext, "originator-profile-set-top", "null");
  await expectStatus(ext, "content-attestation-set", "cancel");
});

test("CAの署名がその発行者のOPで配布される検証鍵を使って検証できない場合閲覧禁止", async ({
  context,
  page,
  missingSiteProfile: _missingSiteProfile,
  validOps: validOps,
  evilCas: evilCas,
  credentialsPage,
}) => {
  await evilCas(credentialsPage.contents, credentialsPage.issuer);
  await validOps({ publicKey, privateKey }, credentialsPage.issuer);
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("p-elm-prohibition-message")).toBeVisible();

  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "cancel");
  await expectStatus(ext, "originator-profile-set-top", "null");
  await expectStatus(ext, "content-attestation-set", "cancel");
});

test("OPの署名がその発行者のOPで配布される検証鍵を使って検証できない場合閲覧禁止", async ({
  context,
  page,
  missingSiteProfile: _missingSiteProfile,
  evilOps: evilOps,
  validCas: validCas,
  credentialsPage,
}) => {
  await validCas(
    { privateKey },
    credentialsPage.contents,
    credentialsPage.issuer,
  );
  await evilOps({ publicKey: publicKey }, credentialsPage.issuer);
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("p-elm-prohibition-message")).toBeVisible();

  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "cancel");
  await expectStatus(ext, "originator-profile-set-top", "cancel");
  await expectStatus(ext, "content-attestation-set", "null");
  await expectStatus(ext, "core-profile", "cancel");
  await expectStatus(ext, "profile-annotation", "cancel");
  await expectStatus(ext, "web-media-profile", "cancel");
});
test("OPとCAの署名がその発行者のOPで配布される検証鍵を使って検証できない場合閲覧禁止", async ({
  context,
  page,
  missingSiteProfile: _missingSiteProfile,
  evilOps: evilOps,
  evilCas: evilCas,
  credentialsPage,
}) => {
  await evilCas(credentialsPage.contents, credentialsPage.issuer);
  await evilOps({ publicKey: publicKey }, credentialsPage.issuer);
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("p-elm-prohibition-message")).toBeVisible();

  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "cancel");
  await expectStatus(ext, "originator-profile-set-top", "cancel");
  await expectStatus(ext, "content-attestation-set", "null");
  await expectStatus(ext, "core-profile", "cancel");
  await expectStatus(ext, "profile-annotation", "cancel");
  await expectStatus(ext, "web-media-profile", "cancel");
});
test("CAのissuerが適切でない場合閲覧禁止", async ({
  context,
  page,
  missingSiteProfile: _missingSiteProfile,
  validOps: validOps,
  validCas: incorrectCas,
  credentialsPage,
}) => {
  await incorrectCas(
    { privateKey },
    credentialsPage.contents,
    "incorrectIssuer",
  );
  await validOps({ publicKey, privateKey }, credentialsPage.issuer);
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext?.getByTestId("p-elm-prohibition-message")).toBeVisible();

  await gotoDetailPage(ext);
  await expectStatus(ext, "site-profile", "cancel");
  await expectStatus(ext, "originator-profile-set-top", "null");
  await expectStatus(ext, "content-attestation-set", "cancel");
});
