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

const organizationName = "Originator Profile 技術研究組合 (開発用)";

test("「第三者による確認」で組織の詳細をサイドパネルの中に示し、戻ると元の位置に戻る", async ({
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

  const accordion = ext.getByTestId("site-header").locator("details");
  await accordion.locator("summary", { hasText: organizationName }).click();
  const trigger = accordion.getByRole("button", { name: "第三者による確認" });
  await trigger.click();

  const view = ext.getByTestId("detail");
  // NOTE: 画面が切り替わったことを、組織名の見出しにフォーカスを移して伝える
  await expect(
    view.getByRole("heading", { level: 1, name: organizationName }),
  ).toBeFocused();
  await expect(
    ext.getByRole("region", { name: organizationName }),
  ).toBeVisible();
  // NOTE: 詳細を表示しているあいだ、後ろの一覧はスクロールさせない
  const rootOverflow = () =>
    ext.evaluate(() => getComputedStyle(document.documentElement).overflowY);
  expect(await rootOverflow()).toBe("hidden");
  await expect(
    view.getByRole("heading", { name: "第三者による確認" }),
  ).toBeVisible();
  await expect(
    view.getByRole("heading", { name: "Example Certification System" }),
  ).toBeVisible();
  const policies = view.locator("section", {
    has: ext.getByRole("heading", { name: "公表している方針" }),
  });
  // NOTE: 新しいタブで開くことを、リンクの名前でも伝える
  await expect(
    policies.getByRole("link", {
      name: /^公式サイト\s*（新しいタブで開きます）$/,
    }),
  ).toHaveAttribute("href", "http://localhost:8080");
  await expect(
    view.getByRole("link", { name: /^このツールについて/ }),
  ).toBeVisible();

  await view.getByRole("button", { name: "戻る" }).click();
  await expect(view).toHaveCount(0);
  expect(await rootOverflow()).toBe("visible");
  await expect(accordion).toHaveAttribute("open");
  await expect(trigger).toBeFocused();
});

test("組織の詳細は組織実在証を示さず、法人登記へのリンクで示す", async ({
  context,
  page,
}) => {
  await page.goto("http://localhost:8080/examples/iframe");
  const ext = await sidepanel(context);

  const card = ext.getByTestId("content-card").first();
  await card.locator("summary").click();
  await card.getByRole("button", { name: "第三者による確認" }).click();

  const view = ext.getByTestId("detail");
  await expect(
    view.locator("header").getByRole("link", { name: /^法人登記/ }),
  ).toHaveAttribute(
    "href",
    "https://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNo=0000000000000",
  );
  await expect(
    view.getByRole("link", {
      name: /^架空業界団体 会員\s*（新しいタブで開きます）$/,
    }),
  ).toHaveAttribute("href", "https://example.org/membership");
  await expect(view.getByText("架空組織実在性検証局 実在証明")).toHaveCount(0);
});
