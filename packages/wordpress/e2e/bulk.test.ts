import { expect, test } from "@wordpress/e2e-test-utils-playwright";

const url = "/wp-admin/tools.php?page=ca-manager-bulk";

test("一括発行の対象確認と入力・nonce検証", async ({ page }) => {
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "CA一括発行", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).not.toContainText("読み込んでいます");
  await expect(page.locator("#profile-ca-bulk-mode")).toHaveValue("missing");
  await expect(page.locator("#profile-ca-bulk-resume")).toBeHidden();
  await expect(page.locator("#profile-ca-bulk-pause")).toBeHidden();
  await expect(page.locator("#profile-ca-bulk-retry")).toBeHidden();
  await expect(page.locator("#profile-ca-bulk-cancel")).toBeHidden();
  await page
    .getByRole("button", { name: "プレビューを取得", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "プレビューを取得しました",
  );
  await expect(page.locator("#profile-ca-bulk-preview-count")).toContainText(
    "候補件数",
  );
  await page.screenshot({ path: "tmp/issue-120-preview.png", fullPage: true });
  await page.getByLabel("開始日", { exact: true }).fill("2025-12-31");
  await page.getByLabel("終了日", { exact: true }).fill("2025-01-01");
  await page
    .getByRole("button", { name: "プレビューを取得", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("開始日は終了日以前");
  const nonce = await page.evaluate(
    () =>
      (window as unknown as { profileCaBulk: { nonce: string } }).profileCaBulk
        .nonce,
  );
  const invalidDate = await page.request.post("/wp-admin/admin-ajax.php", {
    form: {
      action: "profile_ca_bulk",
      operation: "preview",
      nonce,
      date_from: "2025-02-30",
    },
  });
  expect(invalidDate.status()).toBe(400);
  const missingNonce = await page.request.post("/wp-admin/admin-ajax.php", {
    form: { action: "profile_ca_bulk", operation: "start" },
  });
  expect(missingNonce.status()).toBe(403);
  const noConfirmation = await page.request.post("/wp-admin/admin-ajax.php", {
    form: { action: "profile_ca_bulk", operation: "start", nonce, mode: "all" },
  });
  expect(noConfirmation.status()).toBe(400);
  expect((await noConfirmation.json()).data.message).toContain("確認");
});

test("保存済みジョブを自動再開せず、明示操作で再開・失敗分を再試行する", async ({
  page,
}) => {
  const job = {
    id: "ui-test",
    status: "running",
    total: 2,
    processed: 1,
    counts: { success: 1, failed: 0, skipped: 0 },
    failed_ids: [] as number[],
    filters: {
      post_type: "post",
      category: 0,
      date_from: "2025-01-01",
      date_to: "2025-12-31",
      mode: "missing",
    },
    log: [] as {
      id: number;
      title: string;
      url: string;
      status: string;
      message: string;
    }[],
  };
  const operations: string[] = [];
  await page.route("**/wp-admin/admin-ajax.php", async (route) => {
    const form = new URLSearchParams(route.request().postData() ?? "");
    if (form.get("action") !== "profile_ca_bulk") return route.continue();
    const operation = form.get("operation") ?? "";
    operations.push(operation);
    if (operation === "step") {
      job.status = "completed";
      job.processed = 2;
      if (operations.includes("retry")) {
        job.counts = { success: 2, failed: 0, skipped: 0 };
        job.failed_ids = [];
      } else {
        job.counts.failed = 1;
        job.failed_ids = [2];
        job.log = [
          {
            id: 2,
            title: "<script>danger</script>",
            url: "javascript:alert(1)",
            status: "failed",
            message: "通信失敗",
          },
        ];
      }
    } else if (operation === "retry") {
      job.status = "running";
      job.counts.failed = 0;
      job.failed_ids = [];
    }
    await route.fulfill({ json: { success: true, data: job } });
  });
  await page.goto(url);
  await expect(
    page.getByRole("button", { name: "一括発行を再開", exact: true }),
  ).toBeVisible();
  expect(operations).toEqual(["status"]);
  await expect(page.getByLabel("開始日", { exact: true })).toHaveValue(
    "2025-01-01",
  );
  await page
    .getByRole("button", { name: "一括発行を再開", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("完了");
  await expect(page.locator("#profile-ca-bulk-failed-count")).toHaveText("1");
  await expect(page.locator("#profile-ca-bulk-log-body")).toContainText(
    "<script>danger</script>",
  );
  await expect(page.locator("#profile-ca-bulk-log-body a")).toHaveCount(0);
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "失敗した記事を再試行", exact: true })
    .click();
  await expect(page.locator("#profile-ca-bulk-success-count")).toHaveText("2");
  await expect(page.locator("#profile-ca-bulk-failed-count")).toHaveText("0");
});

test("処理中ステップの通信失敗後に自動操作せず状態を再取得できる", async ({
  page,
}) => {
  const job = {
    id: "ui-test-cancel",
    status: "running",
    total: 2,
    processed: 0,
    counts: { success: 0, failed: 0, skipped: 0 },
    failed_ids: [] as number[],
    filters: {
      post_type: "post",
      category: 0,
      date_from: "2025-01-01",
      date_to: "2025-12-31",
      mode: "missing",
    },
    log: [] as {
      id: number;
      title: string;
      url: string;
      status: string;
      message: string;
    }[],
  };
  const operations: string[] = [];
  let resolveStepStarted!: () => void;
  const stepStarted = new Promise<void>((resolve) => {
    resolveStepStarted = resolve;
  });
  let releaseStep!: () => void;
  const stepAbort = new Promise<void>((resolve) => {
    releaseStep = resolve;
  });
  let stepRequests = 0;

  await page.route("**/wp-admin/admin-ajax.php", async (route) => {
    const form = new URLSearchParams(route.request().postData() ?? "");
    if (form.get("action") !== "profile_ca_bulk") return route.continue();
    const operation = form.get("operation") ?? "";
    operations.push(operation);

    if (operation === "status") {
      await route.fulfill({ json: { success: true, data: job } });
      return;
    }
    if (operation === "step") {
      stepRequests += 1;
      if (stepRequests === 1) {
        resolveStepStarted();
        await stepAbort;
        await route.abort();
        return;
      }
      await route.fulfill({
        json: { success: true, data: { ...job, status: "completed" } },
      });
      return;
    }
    if (operation === "cancel") {
      await route.fulfill({
        json: { success: true, data: { ...job, status: "cancelled" } },
      });
      return;
    }
    await route.continue();
  });

  await page.goto(url);
  const resume = page.getByRole("button", {
    name: "一括発行を再開",
    exact: true,
  });
  const cancel = page.getByRole("button", {
    name: "一括発行をキャンセル",
    exact: true,
  });
  const refresh = page.getByRole("button", {
    name: "状態を再取得",
    exact: true,
  });
  await expect(resume).toBeVisible();
  expect(operations).toEqual(["status"]);

  await resume.click();
  await stepStarted;
  await expect(cancel).toBeVisible();
  await cancel.click();
  releaseStep();

  await expect(refresh).toBeEnabled();
  await expect(resume).toBeVisible();
  expect(operations).toEqual(["status", "step"]);

  await refresh.click();
  await expect(page.getByRole("status")).toContainText(
    "実行中のジョブがあります",
  );
  await expect(resume).toBeVisible();
  expect(operations).toEqual(["status", "step", "status"]);
});
