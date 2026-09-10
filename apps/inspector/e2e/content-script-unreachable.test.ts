import { mergeTests } from "@playwright/test";
import { test as base, expect, sidepanel } from "./fixtures";
import { gotoDetailPage } from "./goto-detail-page";
import { test as staticHtmlTest } from "./static-html-fixtures";

const test = mergeTests(base, staticHtmlTest);

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
  await expect(messages).toContainText(
    "サイトの運営者またはコンテンツ作成者を検証できませんでした",
  );
  const items = await messages.getByRole("listitem").allTextContents();
  expect(items.filter((item) => item.trim() === "")).toEqual([]);

  await gotoDetailPage(ext);
  const otherErrors = ext.getByTestId("other-errors");
  await expect(otherErrors).toContainText("UNSPECIFIED");
  await expect(otherErrors).toContainText("No response from top level frame");
});
