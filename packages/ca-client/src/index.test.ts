import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import * as publicApi from "./index.ts";

test("public API: exports the client, CAS file helpers, site operations, and error types", () => {
  expect(Object.keys(publicApi).sort()).toEqual([
    "CaClientError",
    "CaClientErrorCode",
    "UnissuablePagesError",
    "compareTargets",
    "createCaClient",
    "decodeCa",
    "inject",
    "isUnauthorized",
    "loadCaConfig",
    "parseCaConfig",
    "readCasFile",
    "renew",
    "signCaFile",
    "sync",
    "writeCasFile",
  ]);
});

test("public API: does not export low-level APIs from index", () => {
  const api = publicApi as Record<string, unknown>;
  expect(api.signByServer).toBeUndefined();
  expect(api.createTokenManager).toBeUndefined();
  expect(api.TokenManager).toBeUndefined();
  expect(api.serverSignOptions).toBeUndefined();
  expect(api.signByCaServer).toBeUndefined();
  expect(api.deleteCasFiles).toBeUndefined();
  expect(api.resolveCasFilePath).toBeUndefined();
  expect(api.parseCasFileContent).toBeUndefined();
  expect(api.extractTargetsFromHtml).toBeUndefined();
  expect(api.extractTextTargetIntegrity).toBeUndefined();
  expect(api.htmlMatchesCasTargets).toBeUndefined();
  expect(api.normalizeTargets).toBeUndefined();
  expect(api.decodeJwtPayload).toBeUndefined();
  expect(api.detectDrift).toBeUndefined();
  expect(api.init).toBeUndefined();
});

test("public API: loadCaConfig and sync are enough to run sync --check", async () => {
  const root = mkdtempSync(join(tmpdir(), "ca-public-api-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "dist", "news"), { recursive: true });
  writeFileSync(
    join(root, "dist", "news", "index.html"),
    `<html><head><title>記事</title><meta name="description" content="説明"><script type="application/ca-set+json" src="/cas/news.cas.json"></script></head><body><main>本文</main></body></html>`,
  );
  writeFileSync(
    join(root, "ca.config.json"),
    JSON.stringify({
      issuer: "dns:example.com",
      origins: ["https://example.com"],
      selectors: [{ selector: "main" }],
    }),
  );

  const config = await publicApi.loadCaConfig(join(root, "ca.config.json"));
  const report = await publicApi.sync(config, { check: true });

  expect(report.pages.map((page) => [page.pathname, page.status])).toEqual([
    ["/news", "missing"],
  ]);
});
