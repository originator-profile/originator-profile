import type { Page } from "@playwright/test";
import { expect, test } from "@wordpress/e2e-test-utils-playwright";

const failure =
  "CAの発行に失敗しました（2026-01-01 00:00）：CAサーバーから有効な発行結果を取得できなかったため、既存のCAを保持しました。";

/** 発行失敗の状態を返す AJAX 応答を差し替え、送信内容を記録する */
async function mockStatus(page: Page, state: { message: string | null }) {
  const requests: URLSearchParams[] = [];
  await page.route("**/admin-ajax.php", async (route) => {
    const body = new URLSearchParams(route.request().postData() || "");
    if (body.get("action") !== "profile_ca_issue_status") {
      return route.continue();
    }
    requests.push(body);
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { post_id: Number(body.get("post_id")), message: state.message },
      }),
    });
  });
  return requests;
}

test("編集画面で発行失敗を通知し、保存後に解消されれば消す", async ({
  admin,
  page,
}) => {
  const state: { message: string | null } = { message: failure };
  const requests = await mockStatus(page, state);
  await admin.createNewPost({ title: "発行失敗の通知" });

  const notice = page.locator(".components-notice.is-error", {
    hasText: "CAの発行に失敗しました",
  });
  await expect(notice).toContainText(failure);
  await expect(
    notice.getByRole("link", { name: "CAサーバーへの接続確認" }),
  ).toHaveAttribute("href", /options-general\.php\?page=ca-manager/);
  expect(requests[0].get("post_id")).toMatch(/^\d+$/);
  expect(requests[0].get("nonce")).toBeTruthy();

  state.message = null;
  const before = requests.length;
  // 保存が終わるたびに確認し直す。表示言語に依存しないようショートカットで保存する。
  await page.keyboard.press("ControlOrMeta+s");
  await expect.poll(() => requests.length).toBeGreaterThan(before);
  await expect(notice).toHaveCount(0);
});

test("前後して返った古い応答で最新の状態を上書きしない", async ({
  admin,
  page,
}) => {
  // 開いたときの問い合わせ（失敗あり）を、保存後の問い合わせ（失敗なし）より後に返す。
  let releaseFirst = () => {};
  const firstHeld = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let count = 0;
  await page.route("**/admin-ajax.php", async (route) => {
    const body = new URLSearchParams(route.request().postData() || "");
    if (body.get("action") !== "profile_ca_issue_status") {
      return route.continue();
    }
    const index = count++;
    if (index === 0) {
      await firstHeld;
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          post_id: Number(body.get("post_id")),
          message: index === 0 ? failure : null,
        },
      }),
    });
  });
  await admin.createNewPost({ title: "古い応答の確認" });
  await expect.poll(() => count).toBe(1);
  await page.keyboard.press("ControlOrMeta+s");
  await expect.poll(() => count).toBe(2);
  releaseFirst();

  const notice = page.locator(".components-notice.is-error", {
    hasText: "CAの発行に失敗しました",
  });
  // 古い応答が反映されないことを、反映に十分な時間を置いて確かめる。
  await page.waitForTimeout(1000);
  await expect(notice).toHaveCount(0);
});

test("不正な nonce では発行失敗の状態を返さない", async ({ page }) => {
  await page.goto("/wp-admin/");
  const response = await page.request.post("/wp-admin/admin-ajax.php", {
    form: { action: "profile_ca_issue_status", nonce: "invalid", post_id: "1" },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).success).toBe(false);
});
