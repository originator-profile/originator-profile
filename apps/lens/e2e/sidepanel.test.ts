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

test("Site Profile だけがあれば運営者と、コンテンツの提供者を確認できないことを示す", async ({
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
  await expect(ext.getByRole("heading", { name: "コンテンツ" })).toBeVisible();
  await expect(ext.getByText("提供者の情報を確認できません")).toBeVisible();
});

test("運営者がメインのコンテンツの提供者と同じなら、サイト名と提供者を示す", async ({
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
  await expect(card.getByText("提供者", { exact: true })).toBeVisible();
  await expect(
    card.locator("summary", { hasText: organizationName }),
  ).toBeVisible();
});

test("Site Profile が無ければ運営者を確認できないことを示す", async ({
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
    "サイト運営者の情報を確認できません",
  );
  await expect(ext.getByTestId("content-card")).toHaveCount(1);
});

test("Site Profile の検証に失敗すれば、置いていないときと同じく運営者を確認できないことを示す", async ({
  context,
  page,
  evilSiteProfile,
  credentialsMissingPage,
}) => {
  await evilSiteProfile(
    { publicKey },
    credentialsMissingPage.issuer,
    credentialsMissingPage.holder,
  );
  await page.goto(credentialsMissingPage.endpoint);
  const ext = await sidepanel(context);

  await expect(ext.getByTestId("site-header")).toHaveText(
    "サイト運営者の情報を確認できません",
  );
  await expect(ext.getByText("提供者の情報を確認できません")).toBeVisible();
});

test("提供者のアコーディオンは同時に 1 つしか開かない", async ({
  context,
  page,
  validSiteProfile,
  validCredentials,
  credentialsPage,
}) => {
  // NOTE: 運営者と提供者を別の組織にして、アコーディオンを 2 つ出す
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
  const provider = ext.getByTestId("content-card").locator("details");

  await operator.locator("summary").click();
  await expect(operator).toHaveAttribute("open");
  await expect(ext.getByRole("link", { name: "公式サイト" })).toBeVisible();

  await provider.locator("summary").click();
  await expect(provider).toHaveAttribute("open");
  await expect(operator).not.toHaveAttribute("open");
  await expect(ext.locator("details[open]")).toHaveCount(1);

  await provider.locator("summary").click();
  await expect(ext.locator("details[open]")).toHaveCount(0);
});

test("提供者の国を国旗と国名で、法人登記と業界団体所属証とともに示す", async ({
  context,
  page,
}) => {
  await page.goto("http://localhost:8080/examples/iframe");
  const ext = await sidepanel(context);

  await ext.getByTestId("content-card").first().locator("summary").click();
  const country = ext.locator("details[open] p", { hasText: "日本" });
  await expect(country).toBeVisible();
  // NOTE: 国旗は拡張機能に同梱したファイルを読み込む
  await expect
    .poll(() =>
      country
        .locator("img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);

  const accordion = ext.locator("details[open]");
  await expect(
    accordion.getByRole("link", { name: /^法人登記/ }),
  ).toHaveAttribute(
    "href",
    "https://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNo=0000000000000",
  );
  await expect(accordion.getByText("架空業界団体 会員資格")).toBeVisible();
});
