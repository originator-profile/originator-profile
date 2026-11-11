import { mergeTests, type Page } from "@playwright/test";
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

const organizationName = "Originator Profile 技術研究組合 (開発用)";

/** オーバーレイの iframe。ページ自身の iframe と区別する */
const overlayOf = (page: Page) =>
  page.locator('iframe[srcdoc*="content-script/iframe.js"]');

test("作成者のアコーディオンを開くと、コンテンツの範囲を強調する", async ({
  context,
  page,
  validSiteProfile,
  validCredentials,
  credentialsPage,
}) => {
  const key = { privateKey, publicKey };
  await validSiteProfile(
    key,
    credentialsPage.issuer,
    "dns:site-operator.example.com",
  );
  await validCredentials(
    key,
    credentialsPage.contents,
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);

  const creator = ext
    .getByTestId("content-card")
    .locator("summary", { hasText: organizationName });
  await creator.click();
  const overlay = overlayOf(page).contentFrame();
  await expect(overlay.getByTestId("highlight-area")).toHaveCount(1);
  await expect(overlay.getByText(organizationName)).toBeVisible();
  // NOTE: 強調はサイドパネルの内容の複製なので、フォーカスも支援技術も向けない
  await expect(overlayOf(page)).toHaveJSProperty("inert", true);

  await creator.click();
  await expect(overlayOf(page)).toHaveCount(0);
});

test("運営者のアコーディオンを開くと、ページ全体を強調する", async ({
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

  await ext
    .getByTestId("site-header")
    .locator("summary", { hasText: organizationName })
    .click();
  const overlay = overlayOf(page).contentFrame();
  const area = overlay.getByTestId("highlight-area");
  await expect(area).toHaveCount(1);
  const box = await area.boundingBox();
  expect(box).toMatchObject({ x: 0, y: 0, ...page.viewportSize() });
  // NOTE: ページ全体は枠だけで囲み、塗らない
  await expect(area).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

test("サブフレームのコンテンツも強調する", async ({ context, page }) => {
  await page.goto("http://localhost:8080/examples/iframe");
  const ext = await sidepanel(context);

  await ext.getByTestId("content-card").first().locator("summary").click();
  const overlay = overlayOf(page).contentFrame();
  await expect(overlay.getByTestId("highlight-area").first()).toBeVisible();
  // NOTE: 同じ CA を読み込んだ iframe が 17 あり、そのすべてを強調する
  await expect
    .poll(() => overlay.getByTestId("highlight-area").count())
    .toBe(17);
  // NOTE: 国名は文言 (_locales) と同じ言語で出す
  await expect(ext.locator("details[open]").getByText("日本")).toBeVisible();
});
