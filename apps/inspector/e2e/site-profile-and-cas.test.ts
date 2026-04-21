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

test("SiteProfile/CASの検証に成功するが、htmlに記載されたOPSの取得に失敗した時にCredentials/SiteProfileコンポーネントが表示されているか", async ({
  context,
  page,
  validSiteProfile,
  validCas: validCas,
  missingOps: _,
  credentialsPage,
}) => {
  await validSiteProfile({ privateKey, publicKey }, credentialsPage.issuer);
  await validCas(
    { privateKey },
    credentialsPage.contents,
    credentialsPage.issuer,
  );
  await page.goto(credentialsPage.endpoint);
  const ext = await popup(context);
  await expect(ext?.getByTestId("site-profile")).toBeVisible();
  expect(await ext?.getByTestId("site-profile-wsp-name").innerText()).toBe(
    "SiteProfileの取得検証",
  );

  await expect(ext?.getByTestId("cas")).toBeVisible();
});

test("CASの検証に成功するが、SiteProfileのWMPの取得に失敗した時にMissingの表示がされているか", async ({
  context,
  page,
  missingMediaSiteProfile,
  validCas: validCas,
  missingOps: _,
  credentialsPage,
}) => {
  await missingMediaSiteProfile(
    { privateKey, publicKey },
    credentialsPage.issuer,
  );
  await validCas(
    { privateKey },
    credentialsPage.contents,
    credentialsPage.issuer,
  );

  await page.goto(credentialsPage.endpoint);
  const ext = await popup(context);
  await expect(ext?.getByTestId("site-profile")).toBeVisible();
  await expect(ext?.getByTestId("cas")).toBeVisible();

  // SiteProfileとCredentialsの両方でMissingが表示されることを確認
  const siteProfileMissing = ext
    ?.getByTestId("site-profile")
    .getByTestId("web-media-profile-missing");
  const credentialsMissing = ext
    ?.getByTestId("cas")
    .getByTestId("web-media-profile-missing");
  await expect(siteProfileMissing).toBeVisible();
  await expect(credentialsMissing).toBeVisible();
  expect(await siteProfileMissing.innerText()).toBe(
    "このサイト運営者に対応する組織情報を正しく読み取れませんでした",
  );
  expect(await credentialsMissing.innerText()).toBe(
    "このサイト運営者に対応する組織情報を正しく読み取れませんでした",
  );
});
