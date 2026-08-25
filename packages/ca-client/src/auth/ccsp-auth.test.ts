import { describe, expect, test, vi } from "vitest";
import { CaClientError, CaClientErrorCode, isUnauthorized } from "../errors";
import type { FetchOperations } from "../fetch-operations";
import {
  getCcspAccessToken,
  parseCcspConfig,
  type CcspAuthConfig,
} from "./ccsp-auth";

const createBase64Config = (
  config: Partial<CcspAuthConfig>,
  withPrefix = false,
): string => {
  const jsonStr = JSON.stringify(config);
  const base64 = Buffer.from(jsonStr, "utf-8").toString("base64");
  return withPrefix ? `CCSP:${base64}` : base64;
};

const validConfig: CcspAuthConfig = {
  authType: "client_secret_post",
  clientId: "test-client-id",
  clientSec: "test-client-secret",
  tokenUrl: "https://api.example.com/token",
};

describe("parseCcspConfig", () => {
  test("parses configs with and without the CCSP: prefix", () => {
    expect(parseCcspConfig(createBase64Config(validConfig, true))).toEqual(
      validConfig,
    );
    expect(parseCcspConfig(createBase64Config(validConfig, false))).toEqual(
      validConfig,
    );
  });

  test("throws when required fields are missing", () => {
    expect(() =>
      parseCcspConfig(createBase64Config({ clientId: "id" })),
    ).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(/authType is required/),
        code: CaClientErrorCode.Config,
      }),
    );
    expect(() =>
      parseCcspConfig(createBase64Config({ ...validConfig, clientId: "" })),
    ).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(/clientId is required/),
        code: CaClientErrorCode.Config,
      }),
    );
    expect(() => parseCcspConfig("CCSP:not-json")).toThrow(
      expect.objectContaining({
        message: "CCSP auth failed: failed to parse config",
        code: CaClientErrorCode.Config,
      }),
    );
    expect(() =>
      parseCcspConfig(
        createBase64Config({ ...validConfig, tokenUrl: "not-a-url" }),
      ),
    ).toThrow(
      expect.objectContaining({
        message: "CCSP auth failed: tokenUrl is not a valid URL",
        code: CaClientErrorCode.Config,
      }),
    );
  });

  test("throws for unsupported authType", () => {
    expect(() =>
      parseCcspConfig(
        createBase64Config({ ...validConfig, authType: "basic" }),
      ),
    ).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(/unsupported auth type/),
        code: CaClientErrorCode.Config,
      }),
    );
  });

  test("throws when decoded JSON is not an object", () => {
    const encoded = Buffer.from("null", "utf-8").toString("base64");
    expect(() => parseCcspConfig(encoded)).toThrow(
      /CCSP auth failed: failed to parse config/,
    );
    expect(() =>
      parseCcspConfig(Buffer.from("[]", "utf-8").toString("base64")),
    ).toThrow(/CCSP auth failed: failed to parse config/);
  });
});

describe("getCcspAccessToken", () => {
  test("fetches a token with client_secret_post", async () => {
    const expectedResponse = {
      access_token: "test-access-token",
      token_type: "Bearer",
      expires_in: 3600,
    };
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => expectedResponse,
        }) as unknown as Response,
    );

    const result = await getCcspAccessToken(validConfig, { fetch: fetchMock });

    expect(result).toEqual(expectedResponse);
    expect(fetchMock).toHaveBeenCalledWith(validConfig.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials&client_id=test-client-id&client_secret=test-client-secret",
    });
  });

  test("wraps HTTP errors as CA_HTTP with status", async () => {
    const mockFetch: FetchOperations = {
      fetch: async () =>
        ({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          text: async () => "nope",
        }) as unknown as Response,
    };

    const error = await getCcspAccessToken(validConfig, mockFetch).then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toMatchObject({
      message: "CCSP auth failed: 401 Unauthorized: nope",
      code: CaClientErrorCode.Http,
      status: 401,
    });
    expect(isUnauthorized(error)).toBe(true);
  });

  test("wraps network failures as CA_HTTP without status", async () => {
    const cause = new TypeError("Failed to fetch");
    const mockFetch: FetchOperations = {
      fetch: async () => {
        throw cause;
      },
    };

    const error = await getCcspAccessToken(validConfig, mockFetch).then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(CaClientError);
    expect(error).toMatchObject({
      message: "CCSP auth failed: Failed to fetch",
      code: CaClientErrorCode.Http,
      cause,
    });
    if (!(error instanceof CaClientError)) {
      throw error;
    }
    expect(error.status).toBeUndefined();
  });

  test("does not include the response body when access_token is missing", async () => {
    const mockFetch: FetchOperations = {
      fetch: async () =>
        ({
          ok: true,
          json: async () => ({ token_type: "Bearer", secret: "do-not-leak" }),
        }) as unknown as Response,
    };

    const error = await getCcspAccessToken(validConfig, mockFetch).then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(CaClientError);
    expect(error).toMatchObject({
      message: "CCSP auth failed: response is missing access_token",
      code: CaClientErrorCode.Response,
    });
    if (!(error instanceof Error)) {
      throw error;
    }
    expect(error.message).not.toContain("do-not-leak");
  });

  test("rejects a non-object token response", async () => {
    const mockFetch: FetchOperations = {
      fetch: async () =>
        ({
          ok: true,
          json: async () => null,
        }) as unknown as Response,
    };

    await expect(
      getCcspAccessToken(validConfig, mockFetch),
    ).rejects.toMatchObject({
      message: "CCSP auth failed: response is missing access_token",
      code: CaClientErrorCode.Response,
    });
  });
});
