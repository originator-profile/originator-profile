import type { Page } from "@playwright/test";
import { expect, test } from "@wordpress/e2e-test-utils-playwright";

const url = "/wp-admin/tools.php?page=ca-manager-bulk";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "request-test",
    status: "running",
    total: 3,
    processed: 0,
    counts: { success: 0, failed: 0, skipped: 0 },
    failed_ids: [],
    filters: {
      post_type: "post",
      category: 0,
      date_from: "2025-01-01",
      date_to: "2025-12-31",
      mode: "missing",
    },
    log: [],
    ...overrides,
  };
}

async function installPendingFetchMock(
  page: Page,
  mode: "fetch" | "body",
  operation: "step" | "preview",
) {
  await page.addInitScript(
    ({ mode: pendingMode, operation: pendingOperation, job }) => {
      const operations: string[] = [];
      const state = window as unknown as {
        __bulkOperations: string[];
      };
      state.__bulkOperations = operations;
      const originalFetch = window.fetch.bind(window);
      const statusData = pendingOperation === "step" ? job : { job: null };

      function abortError() {
        return new DOMException("Aborted", "AbortError");
      }

      function rejectOnAbort(signal: AbortSignal | null | undefined) {
        return new Promise<never>((_resolve, reject) => {
          const rejectAborted = () => reject(abortError());
          if (signal && signal.aborted) {
            rejectAborted();
            return;
          }
          signal?.addEventListener("abort", rejectAborted, { once: true });
        });
      }

      window.fetch = (input, init) => {
        const body = init?.body;
        if (
          !(body instanceof URLSearchParams) ||
          body.get("action") !== "profile_ca_bulk"
        ) {
          return originalFetch(input, init);
        }

        const operation = body.get("operation") || "";
        operations.push(operation);
        const signal = init?.signal;
        if (operation === pendingOperation && pendingMode === "fetch") {
          return rejectOnAbort(signal);
        }
        if (operation === pendingOperation && pendingMode === "body") {
          return Promise.resolve({
            ok: true,
            json: () => rejectOnAbort(signal),
          } as unknown as Response);
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: statusData,
            }),
            {
              headers: { "content-type": "application/json" },
            },
          ),
        );
      };
    },
    { mode, operation, job: makeJob() },
  );
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const timeoutCases = [
  { operation: "step", mode: "fetch", timeout: 300000 },
  { operation: "step", mode: "body", timeout: 300000 },
  { operation: "preview", mode: "fetch", timeout: 60000 },
] as const;

for (const { operation, mode, timeout } of timeoutCases) {
  test(`${operation}の${mode}待機が時間切れになると自動再送せず復帰できる`, async ({
    page,
  }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await installPendingFetchMock(page, mode, operation);
    await page.goto(url);
    const action = page.getByRole("button", {
      name: operation === "step" ? "一括発行を再開" : "プレビューを取得",
      exact: true,
    });
    const refresh = page.getByRole("button", {
      name: "状態を再取得",
      exact: true,
    });
    const operations = () =>
      page.evaluate(
        () =>
          (window as unknown as { __bulkOperations: string[] })
            .__bulkOperations,
      );
    await expect(action).toBeEnabled();
    await action.click();
    await expect.poll(operations).toEqual(["status", operation]);
    await page.clock.fastForward(timeout - 1);
    await expect(refresh).toBeDisabled();
    await page.clock.fastForward(1);
    await expect(page.getByRole("status")).toContainText(
      "通信に失敗しました。",
    );
    await expect(refresh).toBeEnabled();
    await expect(action).toBeEnabled();
    expect(await operations()).toEqual(["status", operation]);
    await refresh.click();
    await expect(refresh).toBeEnabled();
    expect(await operations()).toEqual(["status", operation, "status"]);
    await expect(page.getByRole("status")).not.toContainText(
      "通信に失敗しました。",
    );
  });
}

test("成功した連続ステップは通知段落を再利用し、完了時にタイマーを解除する", async ({
  page,
}) => {
  await page.clock.install({ time: "2026-01-01T00:00:00" });
  const operations: string[] = [];
  const firstStepStarted = deferred();
  const releaseFirstStep = deferred();
  const releaseSecondStep = deferred();
  let stepNumber = 0;

  await page.route("**/wp-admin/admin-ajax.php", async (route) => {
    const form = new URLSearchParams(route.request().postData() ?? "");
    if (form.get("action") !== "profile_ca_bulk") {
      return route.continue();
    }
    const operation = form.get("operation") ?? "";
    operations.push(operation);
    if (operation === "status") {
      await route.fulfill({ json: { success: true, data: makeJob() } });
      return;
    }
    if (operation === "step") {
      stepNumber += 1;
      if (stepNumber === 1) {
        firstStepStarted.resolve();
        await releaseFirstStep.promise;
      } else if (stepNumber === 2) {
        await releaseSecondStep.promise;
      }
      const completed = stepNumber === 2;
      await route.fulfill({
        json: {
          success: true,
          data: makeJob({
            total: 2,
            processed: stepNumber,
            status: completed ? "completed" : "running",
            counts: { success: stepNumber, failed: 0, skipped: 0 },
          }),
        },
      });
      return;
    }
    await route.continue();
  });

  await page.goto(url);
  await expect(
    page.getByRole("button", { name: "一括発行を再開", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const state = window as unknown as { __bulkAbortCalls: number };
    state.__bulkAbortCalls = 0;
    const originalAbort = Object.getOwnPropertyDescriptor(
      AbortController.prototype,
      "abort",
    )?.value as (this: AbortController, reason?: unknown) => void;
    AbortController.prototype.abort = function (reason?: unknown) {
      state.__bulkAbortCalls += 1;
      return originalAbort.call(this, reason);
    };
  });

  await page
    .getByRole("button", { name: "一括発行を再開", exact: true })
    .click();
  await firstStepStarted.promise;
  await page.locator("#profile-ca-bulk-status > p").evaluate((node) => {
    node.setAttribute("data-e2e-status-node", "initial");
  });
  releaseFirstStep.resolve();
  await expect(page.locator("#profile-ca-bulk-progress")).toHaveText(
    "進捗: 1 / 2件",
  );
  await expect(page.locator("#profile-ca-bulk-status > p")).toHaveAttribute(
    "data-e2e-status-node",
    "initial",
  );

  releaseSecondStep.resolve();
  await expect(page.getByRole("status")).toContainText(
    "一括発行が完了しました。",
  );
  await expect(
    page.locator("#profile-ca-bulk-status > p[data-e2e-status-node]"),
  ).toHaveCount(0);
  expect(operations).toEqual(["status", "step", "step"]);

  await page.clock.fastForward(300000);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __bulkAbortCalls: number }).__bulkAbortCalls,
    ),
  ).toBe(0);
});
