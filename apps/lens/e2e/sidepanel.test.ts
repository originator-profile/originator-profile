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

const siteName = "SiteProfileの取得検証";
const organizationName = "Originator Profile 技術研究組合 (開発用)";

test("Site Profile だけがあれば運営者と、メインのコンテンツが無いことを示す", async ({
  context,
  page,
  validSiteProfile,
  credentialsMissingPage,
}) => {
  await validSiteProfile(
    { privateKey, publicKey },
    credentialsMissingPage.issuer,
    credentialsMissingPage.holder,
  );
  await page.goto(credentialsMissingPage.endpoint);
  const ext = await sidepanel(context);

  const header = ext.getByTestId("site-header");
  await expect(header.getByRole("heading", { name: siteName })).toBeVisible();
  await expect(header.getByText("サイト運営者")).toBeVisible();
  expect(await ext.evaluate(() => document.documentElement.lang)).toBe("ja");
  await expect(
    header.locator("summary", { hasText: organizationName }),
  ).toBeVisible();
  await expect(
    ext.getByText(
      "このページにはメインコンテンツの出どころの情報がありません。",
    ),
  ).toBeVisible();
});

test("運営者がメインのコンテンツの作成者と同じなら、サイト名と作成者を示す", async ({
  context,
  page,
  validSiteProfile,
  validCredentials,
  credentialsPage,
}) => {
  await validSiteProfile(
    { privateKey, publicKey },
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  await validCredentials(
    { privateKey, publicKey },
    credentialsPage.contents,
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);

  const header = ext.getByTestId("site-header");
  await expect(header.getByRole("heading", { name: siteName })).toBeVisible();
  await expect(header.locator("details")).toHaveCount(0);

  const card = ext.getByTestId("content-card");
  await expect(
    card.getByRole("heading", { name: "<Webページのタイトル>" }),
  ).toBeVisible();
  await expect(
    card.locator("summary", { hasText: organizationName }),
  ).toBeVisible();
});

test("Site Profile が無ければ運営者情報が無いことを示す", async ({
  context,
  page,
  missingSiteProfile: _,
  validCredentials,
  credentialsPage,
}) => {
  await validCredentials(
    { privateKey, publicKey },
    credentialsPage.contents,
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);

  await expect(ext.getByTestId("site-header")).toHaveText(
    "サイト運営者情報はありません",
  );
  await expect(ext.getByTestId("content-card")).toHaveCount(1);
});

test("作成者のアコーディオンは同時に 1 つしか開かない", async ({
  context,
  page,
  validSiteProfile,
  validCredentials,
  credentialsPage,
}) => {
  // NOTE: 運営者と作成者を別の組織にして、アコーディオンを 2 つ出す
  await validSiteProfile(
    { privateKey, publicKey },
    credentialsPage.issuer,
    "dns:site-operator.example.com",
  );
  await validCredentials(
    { privateKey, publicKey },
    credentialsPage.contents,
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);

  const operator = ext.getByTestId("site-header").locator("details");
  const creator = ext.getByTestId("content-card").locator("details");

  await operator.locator("summary").click();
  await expect(operator).toHaveAttribute("open");
  await expect(ext.getByRole("link", { name: "公式サイト" })).toBeVisible();

  await creator.locator("summary").click();
  await expect(creator).toHaveAttribute("open");
  await expect(operator).not.toHaveAttribute("open");
  await expect(ext.locator("details[open]")).toHaveCount(1);

  await creator.locator("summary").click();
  await expect(ext.locator("details[open]")).toHaveCount(0);
});
