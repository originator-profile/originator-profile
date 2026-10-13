import { mergeTests } from "@playwright/test";
import privateKey from "./account-key.example.priv.json" with { type: "json" };
import publicKey from "./account-key.example.pub.json" with { type: "json" };
import { test as credentialsTest } from "./credentials-fixtures";
import { test as base, expect, sidepanel } from "./fixtures";
import { gotoDetailPage } from "./goto-detail-page";
import { test as siteProfileTest } from "./site-profile-fixtures";
import { test as staticHtmlTest } from "./static-html-fixtures";

const test = mergeTests(base, siteProfileTest, staticHtmlTest, credentialsTest);

// NOTE: chromewebstore.google.com のようにコンテンツスクリプトを注入できないページ
// では、Site Profile の取得要求そのものが届かず、code を持たないエラーになる。
// 存在しない tabId はこれと同じ経路を通る。
const UNREACHABLE_TAB_ID = 999999;

test("コンテンツスクリプトに到達できない場合も理由が表示されるか", async ({
  context,
  page,
  credentialsMissingPage,
}) => {
  await page.goto(credentialsMissingPage.endpoint);
  const ext = await sidepanel(context, UNREACHABLE_TAB_ID);

  const messages = ext.getByTestId("p-elm-unsupported-message");
  await expect(messages).toBeVisible();
  await expect(messages.getByRole("listitem")).toHaveText([
    "サイトの運営者またはコンテンツ作成者を検証するためのデータが存在しないか、取得できませんでした",
  ]);

  await gotoDetailPage(ext);
  const otherErrors = ext.getByTestId("other-errors");
  await expect(otherErrors).toContainText("UNSPECIFIED");
  await expect(otherErrors).toContainText("No response from top level frame");
});

test("コンテンツスクリプトの入らないタブに切り替えたら前のタブの結果を表示しない", async ({
  context,
  page,
  missingSiteProfile: _missingSiteProfile,
  credentialsPage,
  validCredentials,
}) => {
  await validCredentials(
    { publicKey, privateKey },
    credentialsPage.contents,
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  await page.goto(credentialsPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext.getByTestId("cas")).toBeVisible();

  const blank = await context.newPage();
  await blank.goto("about:blank");
  await blank.bringToFront();

  await expect(ext.getByTestId("p-elm-unsupported-message")).toBeVisible();
  await expect(ext.getByTestId("cas")).toBeHidden();
});
