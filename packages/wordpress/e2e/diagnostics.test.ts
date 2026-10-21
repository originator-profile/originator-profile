import type { Page } from "@playwright/test";
import { expect, test } from "@wordpress/e2e-test-utils-playwright";

const settingsUrl = "/wp-admin/options-general.php?page=ca-manager";
const checkButton = (page: Page) =>
  page.getByRole("button", { name: "接続確認", exact: true });
const status = (page: Page) => page.locator("#profile-ca-diagnostics-status");

/** 接続確認の AJAX 応答を差し替え、送信内容を記録する */
async function mockCheck(page: Page, payload: unknown, httpStatus = 200) {
  const requests: URLSearchParams[] = [];
  await page.route("**/admin-ajax.php", async (route) => {
    const body = new URLSearchParams(route.request().postData() || "");
    if (body.get("action") !== "profile_ca_diagnostics") {
      return route.continue();
    }
    requests.push(body);
    return route.fulfill({
      status: httpStatus,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
  return requests;
}

test("接続確認の結果を段階ごとに表示する", async ({ page }) => {
  const requests = await mockCheck(page, {
    success: true,
    data: {
      state: "success",
      stages: {
        reachability: { status: "ok", message: "CAサーバーに接続できました。" },
        authentication: {
          status: "ok",
          message: "認証情報はCAサーバーで受け付けられました。",
        },
      },
    },
  });
  await page.goto(settingsUrl);
  expect(requests).toHaveLength(0);

  await checkButton(page).click();
  await expect(status(page)).toHaveClass(/notice-success/);
  await expect(status(page)).toContainText(
    "CAサーバーへの接続：OK CAサーバーに接続できました。",
  );
  await expect(status(page)).toContainText(
    "認証情報：OK 認証情報はCAサーバーで受け付けられました。",
  );
  await expect(checkButton(page)).toBeEnabled();
  expect(requests).toHaveLength(1);
  expect(requests[0].get("nonce")).toBeTruthy();
});

test("認証の失敗と未保存の変更を知らせる", async ({ page }) => {
  await mockCheck(page, {
    success: true,
    data: {
      state: "error",
      stages: {
        reachability: { status: "ok", message: "CAサーバーに接続できました。" },
        authentication: {
          status: "ng",
          message: "CAサーバーで認証情報が拒否されました（HTTP 401）。",
        },
      },
    },
  });
  await page.goto(settingsUrl);
  await page
    .locator('[name="profile_ca_issuer_id"]')
    .fill("dns:edited.example.net");

  await checkButton(page).click();
  await expect(status(page)).toHaveClass(/notice-error/);
  await expect(status(page)).toContainText("認証情報：NG");
  await expect(status(page)).toContainText("保存されていない変更があります。");
});

test("権限エラーを表示する", async ({ page }) => {
  await mockCheck(
    page,
    {
      success: false,
      data: { message: "権限がないか、画面の有効期限が切れています。" },
    },
    403,
  );
  await page.goto(settingsUrl);
  await checkButton(page).click();
  await expect(status(page)).toHaveClass(/notice-error/);
  await expect(status(page)).toContainText("画面の有効期限が切れています");
});

test("不正な nonce では接続確認を実行しない", async ({ page }) => {
  await page.goto(settingsUrl);
  const response = await page.request.post("/wp-admin/admin-ajax.php", {
    form: { action: "profile_ca_diagnostics", nonce: "invalid" },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).success).toBe(false);
});

test("想定外の state は警告として表示する", async ({ page }) => {
  await mockCheck(page, {
    success: true,
    data: {
      state: "success hidden",
      stages: {
        reachability: { status: "ok", message: "CAサーバーに接続できました。" },
      },
    },
  });
  await page.goto(settingsUrl);
  await checkButton(page).click();
  await expect(status(page)).toHaveClass("notice notice-warning inline");
  await expect(status(page)).toContainText("CAサーバーへの接続：OK");
});

test("タイムアウトと通信エラーを別のメッセージで表示する", async ({ page }) => {
  await page.clock.install();
  // 応答を返さず、タイムアウトさせる。
  await page.route("**/admin-ajax.php", async (route) => {
    const body = new URLSearchParams(route.request().postData() || "");
    if (body.get("action") !== "profile_ca_diagnostics") {
      return route.continue();
    }
  });
  await page.goto(settingsUrl);
  await checkButton(page).click();
  await expect(status(page)).toContainText("確認中です");
  await page.clock.runFor(90000);
  await expect(status(page)).toHaveClass(/notice-error/);
  await expect(status(page)).toContainText("確認がタイムアウトしました。");
  await expect(checkButton(page)).toBeEnabled();

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.route("**/admin-ajax.php", async (route) => {
    const body = new URLSearchParams(route.request().postData() || "");
    if (body.get("action") !== "profile_ca_diagnostics") {
      return route.continue();
    }
    return route.abort("failed");
  });
  await checkButton(page).click();
  await expect(status(page)).toContainText("確認結果を取得できませんでした。");
  await expect(status(page)).not.toContainText("タイムアウト");
});
