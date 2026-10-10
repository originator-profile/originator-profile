import type { VerificationEntry } from "@originator-profile/extension-common";
import { mergeTests, type BrowserContext, type Worker } from "@playwright/test";
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
function settledResult(
  worker: Worker,
  url: string,
  casCount: number,
  options: { status?: boolean } = {},
) {
  /* eslint-disable no-await-in-loop -- Service Worker内で逐次ポーリングするため意図的 */
  return worker.evaluate(
    async ({ url, casCount, status }) => {
      for (let i = 0; i < 50; i++) {
        const stored = await chrome.storage.session.get(null);
        const entry = Object.entries(stored)
          .filter(([key]) => key.startsWith("verification:document:"))
          .map(([, value]) => value as VerificationEntry)
          .find(
            (entry) =>
              entry.state === "settled" &&
              entry.subject.url === url &&
              entry.result.outcome?.cas.length === casCount &&
              (status === undefined || entry.result.status === status),
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
    { url, casCount, status: options.status },
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

  expect(
    await settledResult(worker, credentialsPage.endpoint, 1),
  ).toMatchObject({ status: true, frameType: "outermost_frame" });
});

test("検証済みの target が変化したら改めて検証される", async ({
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
  expect(
    await settledResult(worker, credentialsPage.endpoint, 1),
  ).toMatchObject({ status: true });

  await page.evaluate(() => {
    const target = document.getElementById("text-target-integrity");
    if (target) target.textContent = "改ざんされた本文";
  });

  expect(
    await settledResult(worker, credentialsPage.endpoint, 1, { status: false }),
  ).toMatchObject({ status: false });
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

test("同じタブで遷移したらサイドパネルの表示が更新される", async ({
  context,
  page,
  missingSiteProfile: _missingSiteProfile,
  credentialsPage,
  credentialsMissingPage,
  validCredentials,
}) => {
  await validCredentials(
    { publicKey, privateKey },
    credentialsPage.contents,
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  await page.goto(credentialsMissingPage.endpoint);
  const ext = await sidepanel(context);
  await expect(ext.getByTestId("p-elm-unsupported-message")).toBeVisible();

  await page.goto(credentialsPage.endpoint);

  await expect(ext.getByTestId("cas")).toBeVisible();
  await expect(ext.getByTestId("p-elm-unsupported-message")).toBeHidden();

  await page.goto(credentialsMissingPage.endpoint);

  await expect(ext.getByTestId("p-elm-unsupported-message")).toBeVisible();
});

test("CA のないまま着地した画面は、後から確定した iframe の CAS に追従する", async ({
  context,
  page,
  validSiteProfile,
  credentialsPage,
  validCredentials,
}) => {
  const key = { publicKey, privateKey };
  // NOTE: Site Profile がないと Base は遷移せずにその場で描画し直すため、
  // CA のないまま site 画面に着地する状況にならない
  await validSiteProfile(key, credentialsPage.issuer, credentialsPage.holder);
  await validCredentials(
    key,
    credentialsPage.contents,
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  const endpoint = "http://localhost:8080/examples/nested-frames.html";
  const frame = `<iframe srcdoc='<iframe src="${credentialsPage.endpoint}"></iframe>'></iframe>`;
  await page.route(endpoint, async (route) =>
    route.fulfill({
      body: `<!doctype html><title>nested frames</title>${frame.repeat(3)}`,
      contentType: "text/html",
    }),
  );
  // NOTE: iframe の文書が現れるのを、トップレベル文書の検証の確定 (着地) より遅らせる
  await page.route(credentialsPage.endpoint, async (route) => {
    await new Promise((resolve) => {
      setTimeout(resolve, 1_000);
    });
    await route.fallback();
  });
  /** オーバーレイ上の iframe ごとの CA のマーカー */
  const frameMarkers = page
    .frameLocator('iframe[srcdoc*="content-script/iframe.js"]')
    .getByRole("button");
  await page.goto(endpoint);
  const ext = await sidepanel(context);
  await expect(ext.getByTestId("cas")).toBeVisible();
  await expect(frameMarkers).toHaveCount(3);
  const before = await ext.getByTestId("cas").elementHandle();

  await page.reload();

  // 再読み込み前の表示が取り除かれてから、改めて表示されるのを待つ
  await before?.waitForElementState("hidden");
  await expect(ext.getByTestId("cas")).toBeVisible();
  await expect(frameMarkers).toHaveCount(3);
  await page.unroute(endpoint);
  await page.unroute(credentialsPage.endpoint);
});
