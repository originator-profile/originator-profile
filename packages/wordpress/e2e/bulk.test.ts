import { expect, test } from "@wordpress/e2e-test-utils-playwright";

const url = "/wp-admin/tools.php?page=ca-manager-bulk";

const dateInputCases = [
  { label: "開始日", requestKey: "date_from" },
  { label: "終了日", requestKey: "date_to" },
] as const;

const dateActionCases = [
  { operation: "preview", button: "プレビューを取得" },
  { operation: "start", button: "一括発行を開始" },
] as const;

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

for (const dateInput of dateInputCases) {
  for (const action of dateActionCases) {
    test(`${dateInput.label}の${action.button}は入力途中だけ送信しない`, async ({
      page,
    }) => {
      const operations: string[] = [];
      await page.route("**/wp-admin/admin-ajax.php", async (route) => {
        const form = new URLSearchParams(route.request().postData() ?? "");
        if (form.get("action") !== "profile_ca_bulk") {
          return route.continue();
        }
        const operation = form.get("operation") ?? "";
        operations.push(operation);
        if (operation === "status") {
          await route.fulfill({
            json: { success: true, data: { job: null } },
          });
          return;
        }
        if (operation === "preview") {
          await route.fulfill({
            json: { success: true, data: { count: 0, sample: [] } },
          });
          return;
        }
        if (operation === "start") {
          await route.fulfill({
            json: {
              success: true,
              data: {
                id: "ui-test-date-validation",
                status: "completed",
                total: 0,
                processed: 0,
                counts: { success: 0, failed: 0, skipped: 0 },
                failed_ids: [],
                log: [],
              },
            },
          });
          return;
        }
        await route.fulfill({ json: { success: true, data: {} } });
      });

      await page.goto(url);
      await expect(page.getByRole("status")).not.toContainText(
        "読み込んでいます",
      );
      const input = page.getByLabel(dateInput.label, { exact: true });
      const button = page.getByRole("button", {
        name: action.button,
        exact: true,
      });
      const waitForActionRequest = () =>
        page.waitForRequest((request) => {
          const form = new URLSearchParams(request.postData() ?? "");
          return (
            request.method() === "POST" &&
            form.get("action") === "profile_ca_bulk" &&
            form.get("operation") === action.operation
          );
        });
      const send = async (value: string) => {
        await input.fill(value);
        const requestPromise = waitForActionRequest();
        await button.click();
        const request = await requestPromise;
        await expect(button).toBeEnabled();
        return new URLSearchParams(request.postData() ?? "");
      };

      await input.fill("");
      await input.click();
      // 部分入力はfillではなくキーボードで再現する。
      await input.pressSequentially("2025-0");
      await expect(input).toHaveValue("");
      expect(
        await input.evaluate(
          (element) => (element as HTMLInputElement).validity.badInput,
        ),
      ).toBe(true);
      await button.click();
      await expect(input).toBeFocused();
      expect(operations).toEqual(["status"]);

      const emptyForm = await send("");
      expect(emptyForm.get(dateInput.requestKey)).toBe("");
      const validForm = await send("2025-01-01");
      expect(validForm.get(dateInput.requestKey)).toBe("2025-01-01");
    });
  }
}

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

test("一時停止・再開後に処理中の記事を待ってキャンセルする", async ({
  page,
}) => {
  const job = {
    id: "ui-test-pause-cancel",
    status: "running",
    total: 3,
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
  let resolveFirstStepStarted!: () => void;
  const firstStepStarted = new Promise<void>((resolve) => {
    resolveFirstStepStarted = resolve;
  });
  let releaseFirstStep!: () => void;
  const firstStepGate = new Promise<void>((resolve) => {
    releaseFirstStep = resolve;
  });
  let resolveFirstStepCompleted!: () => void;
  const firstStepCompleted = new Promise<void>((resolve) => {
    resolveFirstStepCompleted = resolve;
  });
  let resolveSecondStepStarted!: () => void;
  const secondStepStarted = new Promise<void>((resolve) => {
    resolveSecondStepStarted = resolve;
  });
  let releaseSecondStep!: () => void;
  const secondStepGate = new Promise<void>((resolve) => {
    releaseSecondStep = resolve;
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
        resolveFirstStepStarted();
        await firstStepGate;
        job.processed = 1;
        await route.fulfill({ json: { success: true, data: job } });
        resolveFirstStepCompleted();
        return;
      }
      if (stepRequests === 2) {
        resolveSecondStepStarted();
        await secondStepGate;
        job.processed = 2;
        await route.fulfill({ json: { success: true, data: job } });
        return;
      }
      await route.fulfill({
        json: { success: true, data: { ...job, status: "completed" } },
      });
      return;
    }
    if (operation === "cancel") {
      job.status = "cancelled";
      await route.fulfill({ json: { success: true, data: job } });
      return;
    }
    await route.continue();
  });

  await page.goto(url);
  const resume = page.getByRole("button", {
    name: "一括発行を再開",
    exact: true,
  });
  const pause = page.getByRole("button", {
    name: "一時停止",
    exact: true,
  });
  const cancel = page.getByRole("button", {
    name: "一括発行をキャンセル",
    exact: true,
  });
  await expect(resume).toBeVisible();
  expect(operations).toEqual(["status"]);

  await resume.click();
  await firstStepStarted;
  await expect(pause).toBeVisible();
  await pause.click();
  releaseFirstStep();
  await firstStepCompleted;
  await expect(resume).toBeVisible();
  await expect(resume).toBeEnabled();
  await expect(page.locator("#profile-ca-bulk-progress")).toHaveText(
    "進捗: 1 / 3件",
  );
  expect(stepRequests).toBe(1);
  expect(operations).toEqual(["status", "step"]);

  await resume.click();
  await secondStepStarted;
  await expect(cancel).toBeVisible();
  await cancel.click();
  releaseSecondStep();

  await expect(page.getByRole("status")).toContainText(
    "一括発行をキャンセルしました。",
  );
  expect(stepRequests).toBe(2);
  expect(operations).toEqual(["status", "step", "step", "cancel"]);
});
