import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { extractTargetsFromHtml } from "../targets/html";
import { detectDrift } from "./compare";

const extractTextIntegrity = async (
  htmlContent: string,
  cssSelector: string,
): Promise<string> => {
  const targets = await extractTargetsFromHtml(htmlContent, {
    textSelectors: [cssSelector],
    externalSelector: ":not(*)",
  });
  const integrity = targets[0]?.integrity;
  if (integrity === undefined) {
    throw new Error("expected at least one extracted target");
  }
  return integrity;
};

const createCasJwt = (payload: Record<string, unknown>) => {
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
  ).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  return `${header}.${encodedPayload}.signature`;
};

const tempDirs: string[] = [];

const writeCasFixture = (fileName: string, contents: unknown): string => {
  const dir = mkdtempSync(join(tmpdir(), "ca-client-drift-"));
  tempDirs.push(dir);
  const casPath = join(dir, fileName);
  writeFileSync(casPath, JSON.stringify(contents), "utf-8");
  return casPath;
};

const writeCasWithTargets = (
  fileName: string,
  targets: Array<Record<string, string>>,
  options?: { wrapped?: boolean },
): string => {
  const jwt = createCasJwt({ target: targets });
  const item = options?.wrapped
    ? { main: true as const, attestation: jwt }
    : jwt;
  return writeCasFixture(fileName, [item]);
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("detectDrift: CAS と現 HTML の target が一致すれば ok", async () => {
  const htmlContent = `
    <article>
      <h1 itemprop="headline">About</h1>
      <div itemprop="articleBody">Same body</div>
    </article>
  `;
  const cssSelector =
    "article [itemprop='headline'], article [itemprop='articleBody']";
  const integrity = await extractTextIntegrity(htmlContent, cssSelector);

  const casPath = writeCasWithTargets("about.cas.json", [
    {
      type: "TextTargetIntegrity",
      cssSelector,
      integrity,
    },
  ]);

  await expect(detectDrift(htmlContent, casPath)).resolves.toEqual({
    status: "ok",
    casFilePath: casPath,
  });
});

test("detectDrift: CAS 記録の selector で再計算し、CIP 既定セレクタに依存しない", async () => {
  const htmlContent = `
    <main>
      <h1 itemprop="headline">News</h1>
      <div itemprop="articleBody">List body</div>
    </main>
  `;
  const cssSelector = "main";
  const integrity = await extractTextIntegrity(htmlContent, cssSelector);

  const casPath = writeCasWithTargets("news.cas.json", [
    {
      type: "TextTargetIntegrity",
      cssSelector,
      integrity,
    },
  ]);

  await expect(detectDrift(htmlContent, casPath)).resolves.toEqual({
    status: "ok",
    casFilePath: casPath,
  });
});

test("detectDrift: text target が drift していれば drifted と current/expected を返す", async () => {
  const htmlContent = `
    <article>
      <h1 itemprop="headline">Privacy</h1>
      <div itemprop="articleBody">Updated body</div>
    </article>
  `;
  const cssSelector =
    "article [itemprop='headline'], article [itemprop='articleBody']";
  const integrity = await extractTextIntegrity(htmlContent, cssSelector);

  const casPath = writeCasWithTargets("privacy.cas.json", [
    {
      type: "TextTargetIntegrity",
      cssSelector,
      integrity: "sha256-stale",
    },
  ]);

  const result = await detectDrift(htmlContent, casPath);
  expect(result).toEqual({
    status: "drifted",
    casFilePath: casPath,
    current: [
      {
        type: "TextTargetIntegrity",
        cssSelector,
        integrity,
      },
    ],
    expected: [
      {
        type: "TextTargetIntegrity",
        cssSelector,
        integrity: "sha256-stale",
      },
    ],
  });
});

test("detectDrift: .target-integrity 差分があれば drifted", async () => {
  const htmlContent = `
    <article>
      <h1 itemprop="headline">Message</h1>
      <div itemprop="articleBody">
        <img class="target-integrity" integrity="sha256-new" src="/test.png" />
      </div>
    </article>
  `;
  const cssSelector =
    "article [itemprop='headline'], article [itemprop='articleBody']";
  const integrity = await extractTextIntegrity(htmlContent, cssSelector);

  const casPath = writeCasWithTargets("chief-director.cas.json", [
    {
      type: "TextTargetIntegrity",
      cssSelector,
      integrity,
    },
    {
      type: "ExternalResourceTargetIntegrity",
      integrity: "sha256-old",
    },
  ]);

  await expect(detectDrift(htmlContent, casPath)).resolves.toMatchObject({
    status: "drifted",
  });
});

test("detectDrift: externalSelector で CIP 以外のマークアップから抽出できる", async () => {
  const htmlContent = `
    <main>Body</main>
    <img class="op-resource" integrity="sha256-img" src="/a.png" />
  `;
  const integrity = await extractTextIntegrity(htmlContent, "main");

  const casPath = writeCasWithTargets("custom-external.cas.json", [
    {
      type: "TextTargetIntegrity",
      cssSelector: "main",
      integrity,
    },
    {
      type: "ExternalResourceTargetIntegrity",
      integrity: "sha256-img",
    },
  ]);

  await expect(
    detectDrift(htmlContent, casPath, { externalSelector: ".op-resource" }),
  ).resolves.toEqual({
    status: "ok",
    casFilePath: casPath,
  });
});

test("detectDrift: CAS ファイルが存在しなければ cas_missing", async () => {
  const htmlContent = `
    <article>
      <h1 itemprop="headline">About</h1>
      <div itemprop="articleBody">Body</div>
    </article>
  `;
  const missingCasPath = join(tmpdir(), "ca-client-drift-missing.cas.json");

  await expect(detectDrift(htmlContent, missingCasPath)).resolves.toEqual({
    status: "cas_missing",
    casFilePath: missingCasPath,
  });
});

test("detectDrift: 現 HTML に target が無ければ html_no_targets", async () => {
  const casPath = writeCasWithTargets("empty.cas.json", [
    {
      type: "TextTargetIntegrity",
      cssSelector: "main",
      integrity: "sha256-xxx",
    },
  ]);

  await expect(
    detectDrift(`<article>itemprop の無い本文だけ</article>`, casPath),
  ).resolves.toEqual({
    status: "html_no_targets",
    casFilePath: casPath,
  });
});

test("detectDrift: CAS が不正なら cas_invalid", async () => {
  const notJson = writeCasFixture("not-json.cas.json", "placeholder");
  writeFileSync(notJson, "{", "utf-8");

  await expect(detectDrift("<main>x</main>", notJson)).resolves.toMatchObject({
    status: "cas_invalid",
    casFilePath: notJson,
  });

  const notArray = writeCasFixture("object.cas.json", { attestation: "x" });
  await expect(detectDrift("<main>x</main>", notArray)).resolves.toEqual({
    status: "cas_invalid",
    casFilePath: notArray,
    reason: "Invalid CAS file format (expected JSON array with JWT string)",
  });

  const badJwt = writeCasFixture("bad-jwt.cas.json", ["not-a-jwt"]);
  await expect(detectDrift("<main>x</main>", badJwt)).resolves.toMatchObject({
    status: "cas_invalid",
    casFilePath: badJwt,
  });
});

test("detectDrift: { main, attestation } 形式の CAS も読める", async () => {
  const htmlContent = `<main>Body</main>`;
  const integrity = await extractTextIntegrity(htmlContent, "main");

  const casPath = writeCasWithTargets(
    "wrapped.cas.json",
    [
      {
        type: "TextTargetIntegrity",
        cssSelector: "main",
        integrity,
      },
    ],
    { wrapped: true },
  );

  await expect(detectDrift(htmlContent, casPath)).resolves.toEqual({
    status: "ok",
    casFilePath: casPath,
  });
});

test("detectDrift: CAS に cssSelector が無いとき textSelector 引数で HTML を評価する", async () => {
  const htmlContent = `<main>Main text</main>`;
  const integrity = await extractTextIntegrity(htmlContent, "main");

  const casPath = writeCasWithTargets("fallback-selector.cas.json", [
    {
      type: "TextTargetIntegrity",
      integrity,
    },
  ]);

  await expect(detectDrift(htmlContent, casPath)).resolves.toEqual({
    status: "html_no_targets",
    casFilePath: casPath,
  });
  await expect(
    detectDrift(htmlContent, casPath, { textSelector: "main" }),
  ).resolves.toEqual({
    status: "ok",
    casFilePath: casPath,
  });
});
