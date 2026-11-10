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

test("「詳細はこちら」で組織の詳細を別ウインドウに開き、ページを移っても残る", async ({
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
  const [detail] = await Promise.all([
    context.waitForEvent("page"),
    ext.getByRole("button", { name: "詳細はこちら" }).click(),
  ]);

  const view = detail.getByTestId("detail");
  await expect(detail).toHaveTitle(`${organizationName} - OP Lens`);
  await expect(
    view.getByRole("heading", { level: 1, name: organizationName }),
  ).toBeVisible();
  await expect(
    view.getByRole("heading", { name: "第三者機関による確認" }),
  ).toBeVisible();
  await expect(
    view.getByRole("heading", { name: "Example Certification System" }),
  ).toBeVisible();
  // NOTE: 新しいタブで開くことを、リンクの名前でも伝える
  await expect(
    view.getByRole("link", { name: /^公式サイト\s*（新しいタブで開きます）$/ }),
  ).toHaveAttribute("href", "http://localhost:8080");

  await page.goto("about:blank");
  await detail.reload();
  await expect(
    detail.getByRole("heading", { level: 1, name: organizationName }),
  ).toBeVisible();
});
