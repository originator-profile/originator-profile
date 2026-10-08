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

test("差し替えられた iframe の結果は残らず、クレデンシャルのない iframe は検証しない", async ({
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
  await settledResult(worker, credentialsPage.endpoint, 1);

  /** クレデンシャルのない iframe を差し替える (広告の差し替えを模す) */
  const replaceFrames = (count: number) =>
    page.evaluate((count) => {
      for (const frame of document.querySelectorAll("iframe")) frame.remove();
      for (let i = 0; i < count; i++) {
        const frame = document.createElement("iframe");
        frame.srcdoc = `<p>ad ${i}</p>`;
        document.body.append(frame);
      }
    }, count);

  /** 確定したサブフレームの結果を、件数がそろうまで待って読む */
  const settledSubFrames = (count: number) =>
    /* eslint-disable no-await-in-loop -- Service Worker内で逐次ポーリングするため意図的 */
    worker.evaluate(async (count) => {
      for (let i = 0; i < 50; i++) {
        const stored = await chrome.storage.session.get(null);
        const entries = Object.entries(stored)
          .filter(([key]) => key.startsWith("verification:document:"))
          .map(([, value]) => value as VerificationEntry)
          .filter(({ subject }) => subject.frameType === "sub_frame");
        if (
          entries.length === count &&
          entries.every(({ state }) => state === "settled")
        ) {
          return entries.map((entry) =>
            entry.state === "settled"
              ? entry.result.securingResults.length
              : -1,
          );
        }
        await new Promise((resolve) => {
          setTimeout(resolve, 100);
        });
      }
      throw new Error("Timeout waiting for settled sub frames");
    }, count);
  /* eslint-enable no-await-in-loop */

  await replaceFrames(3);
  // 検証していないため、レジストリの VC を保持しない
  expect(await settledSubFrames(3)).toEqual([0, 0, 0]);

  await replaceFrames(1);
  expect(await settledSubFrames(1)).toEqual([0]);
});

test("同じオリジン内の遷移では Site Profile を取得し直さない", async ({
  context,
  page,
  validSiteProfile,
  credentialsPage,
  credentialsMissingPage,
  validCredentials,
}) => {
  const key = { publicKey, privateKey };
  await validSiteProfile(key, credentialsPage.issuer, credentialsPage.holder);
  await validCredentials(
    key,
    credentialsPage.contents,
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  let fetched = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/.well-known/sp.json")) fetched += 1;
  });
  await page.goto("about:blank");
  const worker = await backgroundWorker(context);

  await page.goto(credentialsMissingPage.endpoint);
  await settledResult(worker, credentialsMissingPage.endpoint, 0);
  const fetchedForFirst = fetched;
  await page.goto(credentialsPage.endpoint);

  // 2 つ目の文書も、Web サイトの発信者を用いて検証される
  expect(await settledResult(worker, credentialsPage.endpoint, 1)).toEqual({
    status: true,
    frameType: "outermost_frame",
  });
  // インストール直後に読み込んだページでも、content script は 1 度だけ実行される
  expect(fetchedForFirst).toBe(1);
  expect(fetched).toBe(fetchedForFirst);
});

test("有効期限を過ぎた Site Profile の検証結果は再利用せずに取得し直す", async ({
  context,
  page,
  validSiteProfile,
  credentialsPage,
  credentialsMissingPage,
  validCredentials,
}) => {
  const key = { publicKey, privateKey };
  await validSiteProfile(key, credentialsPage.issuer, credentialsPage.holder);
  await validCredentials(
    key,
    credentialsPage.contents,
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  let fetched = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/.well-known/sp.json")) fetched += 1;
  });
  await page.goto("about:blank");
  const worker = await backgroundWorker(context);
  await page.goto(credentialsMissingPage.endpoint);
  await settledResult(worker, credentialsMissingPage.endpoint, 0);
  expect(fetched).toBe(1);

  // 保持した Site Profile の検証結果の VC を、有効期限を過ぎたものにする
  await worker.evaluate(async () => {
    const stored = await chrome.storage.session.get(null);
    const [key, entry] =
      Object.entries(stored).find(([key]) =>
        key.startsWith("verification:site-profile:"),
      ) ?? [];
    if (!key) throw new Error("Site Profile の検証結果を保持しているはず");
    const { result } = entry as {
      result: { securingResults: { expiredAt?: string }[] };
    };
    const expiredAt = new Date(0).toISOString();
    await chrome.storage.session.set({
      [key]: {
        ...(entry as object),
        result: {
          ...result,
          securingResults: result.securingResults.map((r) => ({
            ...r,
            expiredAt,
          })),
        },
      },
    });
  });
  await page.goto(credentialsPage.endpoint);

  expect(await settledResult(worker, credentialsPage.endpoint, 1)).toEqual({
    status: true,
    frameType: "outermost_frame",
  });
  expect(fetched).toBe(2);
});

test("保持する結果は VC の原文と共有の発信者を含まない", async ({
  context,
  page,
  validSiteProfile,
  credentialsPage,
  validCredentials,
}) => {
  const key = { publicKey, privateKey };
  await validSiteProfile(key, credentialsPage.issuer, credentialsPage.holder);
  await validCredentials(
    key,
    credentialsPage.contents,
    credentialsPage.issuer,
    credentialsPage.holder,
  );
  await page.goto("about:blank");
  const worker = await backgroundWorker(context);
  await page.goto(credentialsPage.endpoint);
  await settledResult(worker, credentialsPage.endpoint, 1);

  const stored = await worker.evaluate(async () => {
    const entries = Object.entries(await chrome.storage.session.get(null));
    const find = (prefix: string) =>
      entries.find(([key]) => key.startsWith(prefix))?.[1] as
        | Record<string, unknown>
        | undefined;
    return {
      document: find("verification:document:"),
      siteProfile: find("verification:site-profile:"),
      registry: find("verification:registry"),
    };
  });
  const json = JSON.stringify(stored);
  const document = stored.document as VerificationEntry | undefined;
  if (document?.state !== "settled") {
    throw new Error("文書の検証は確定しているはず");
  }

  // VC の原文 (JWT) を保持しない
  expect(json).not.toMatch(/eyJ[\w-]+\.[\w-]+\.[\w-]+/);
  // 文書の結果は文書の発信者だけを含み、共有の発信者は SP エントリが持つ
  expect(document.result.outcome?.originators).toHaveLength(1);
  expect(stored.siteProfile).not.toHaveProperty("siteProfile");
  expect(stored.registry).toMatchObject({ status: true });
});

test("Service Worker が起動し直しても、保持したレジストリの検証結果を再利用する", async ({
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
  await page.goto("about:blank");
  const worker = await backgroundWorker(context);
  await page.goto(credentialsPage.endpoint);
  await settledResult(worker, credentialsPage.endpoint, 1);

  // 保持したレジストリの検証結果に印を付け、Service Worker を止める
  await worker.evaluate(async () => {
    const key = "verification:registry";
    const { [key]: entry } = await chrome.storage.session.get(key);
    await chrome.storage.session.set({
      [key]: { ...(entry as object), marker: true },
    });
    Object.assign(globalThis, { beforeRestart: true });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.stopAllWorkers");

  // 起動し直した Service Worker で、別の文書を検証させる
  await page.goto(credentialsMissingPage.endpoint);
  const restarted = await backgroundWorker(context);
  await settledResult(restarted, credentialsMissingPage.endpoint, 0);

  expect(
    await restarted.evaluate(async () => ({
      restarted: !("beforeRestart" in globalThis),
      registry: (await chrome.storage.session.get("verification:registry"))[
        "verification:registry"
      ],
    })),
  ).toMatchObject({ restarted: true, registry: { marker: true } });
});
