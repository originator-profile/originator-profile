import { expect, test } from "vitest";
import * as publicApi from "./index";

test("public API: exports createCaClient, writeCasFile, readCasFile, detectDrift, and error types", () => {
  expect(typeof publicApi.createCaClient).toBe("function");
  expect(typeof publicApi.writeCasFile).toBe("function");
  expect(typeof publicApi.readCasFile).toBe("function");
  expect(typeof publicApi.detectDrift).toBe("function");
  expect(typeof publicApi.isUnauthorized).toBe("function");
  expect(publicApi.CaClientError).toBeDefined();
  expect(Object.keys(publicApi).sort()).toEqual([
    "CaClientError",
    "CaClientErrorCode",
    "createCaClient",
    "detectDrift",
    "isUnauthorized",
    "readCasFile",
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
});
