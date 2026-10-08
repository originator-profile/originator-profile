import type { VerificationEntry } from "@originator-profile/extension-common";
import { mergeTests, type BrowserContext, type Worker } from "@playwright/test";
import privateKey from "./account-key.example.priv.json" with { type: "json" };
import publicKey from "./account-key.example.pub.json" with { type: "json" };
import { test as credentialsTest } from "./credentials-fixtures";
import { test as base, expect } from "./fixtures";
import { test as siteProfileTest } from "./site-profile-fixtures";
import { test as staticHtmlTest } from "./static-html-fixtures";

const test = mergeTests(
  base,
  siteProfileTest,
  staticHtmlTest,
  credentialsTest,
).extend({});

async function backgroundWorker(context: BrowserContext): Promise<Worker> {
  return (
    context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"))
  );
}

/**
 * Service Worker の検証結果ストアから、文書の確定した検証結果を待って読む
 * @param worker Service Worker
 * @param url 文書の URL
 * @param casCount 確定を待つ Content Attestation の件数
 */
function settledResult(worker: Worker, url: string, casCount: number) {
  /* eslint-disable no-await-in-loop -- Service Worker内で逐次ポーリングするため意図的 */
  return worker.evaluate(
    async ({ url, casCount }) => {
      for (let i = 0; i < 50; i++) {
        const stored = await chrome.storage.session.get(null);
        const entry = Object.entries(stored)
          .filter(([key]) => key.startsWith("verification:document:"))
          .map(([, value]) => value as VerificationEntry)
          .find(
            (entry) =>
              entry.state === "settled" &&
              entry.subject.url === url &&
              entry.result.outcome?.cas.length === casCount,
          );
        if (entry?.state === "settled") {
          return {
            status: entry.result.status,
            frameType: entry.subject.frameType,
          };
        }
        await new Promise((resolve) => {
          setTimeout(resolve, 100);
        });
      }
      throw new Error("Timeout waiting for settled verification");
    },
    { url, casCount },
  );
  /* eslint-enable no-await-in-loop */
}

test("サイドパネルを開かずに文書の検証結果が保持される", async ({
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
  await page.goto("about:blank");
  const worker = await backgroundWorker(context);

  await page.goto(credentialsPage.endpoint);

  expect(await settledResult(worker, credentialsPage.endpoint, 1)).toEqual({
    status: true,
    frameType: "outermost_frame",
  });
});

test("後から挿入された CAS も検証される", async ({
  context,
  page,
  missingSiteProfile: _missingSiteProfile,
  credentialsPage,
  validCredentials,
}) => {
  // クレデンシャルの script 要素を含まない状態で配信する
  const contents = `
<!doctype html>
<html lang="ja" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <title>CAS/OPSを後から挿入するテストページ</title>
</head>
<body>
  <p id="text-target-integrity">CAS/OPSを後から挿入するテストページ</p>
</body>
</html>`;
  await validCredentials(
    { publicKey, privateKey },
    contents,
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  const endpoint = "http://localhost:8080/examples/dynamic-credentials.html";
  await page.route(endpoint, async (route) =>
    route.fulfill({ body: contents, contentType: "text/html" }),
  );
  await page.goto("about:blank");
  const worker = await backgroundWorker(context);

  await page.goto(endpoint);
  await page.waitForLoadState("load");
  expect(await settledResult(worker, endpoint, 0)).toMatchObject({
    status: true,
  });

  await page.evaluate(() => {
    for (const [type, src] of [
      ["application/ops+json", "/examples/ops.json"],
      ["application/cas+json", "/examples/cas.json"],
    ] as const) {
      const script = document.createElement("script");
      script.type = type;
      script.src = src;
      document.body.append(script);
    }
  });

  expect(await settledResult(worker, endpoint, 1)).toMatchObject({
    status: true,
  });
  await page.unroute(endpoint);
});
