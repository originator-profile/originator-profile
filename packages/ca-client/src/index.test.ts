import { expect, test } from "vitest";
import * as publicApi from "./index";

test("public API: exports the CA client, CAS files, and site operations", () => {
  expect(typeof publicApi.createCaClient).toBe("function");
  expect(typeof publicApi.writeCasFile).toBe("function");
  expect(typeof publicApi.readCasFile).toBe("function");
  expect(typeof publicApi.loadConfig).toBe("function");
  expect(typeof publicApi.parseConfig).toBe("function");
  expect(typeof publicApi.sync).toBe("function");
  expect(typeof publicApi.inject).toBe("function");
  expect(typeof publicApi.renew).toBe("function");
  expect(typeof publicApi.buildUnsignedCa).toBe("function");
  expect(typeof publicApi.isUnauthorized).toBe("function");
  expect(publicApi.CaClientError).toBeDefined();
  expect(Object.keys(publicApi).sort()).toEqual([
    "CaClientError",
    "CaClientErrorCode",
    "buildUnsignedCa",
    "createCaClient",
    "inject",
    "isUnauthorized",
    "loadConfig",
    "parseConfig",
    "readCasFile",
    "renew",
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
  expect(api.detectDrift).toBeUndefined();
  expect(api.resolveCasFilePath).toBeUndefined();
  expect(api.parseCasFileContent).toBeUndefined();
  expect(api.extractTargetsFromHtml).toBeUndefined();
  expect(api.extractTextTargetIntegrity).toBeUndefined();
  expect(api.htmlMatchesCasTargets).toBeUndefined();
  expect(api.normalizeTargets).toBeUndefined();
  expect(api.decodeJwtPayload).toBeUndefined();
});
