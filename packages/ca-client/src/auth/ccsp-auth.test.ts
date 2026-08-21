import { describe, expect, test, vi } from "vitest";
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
    ).toThrow(/authType is required/);
    expect(() =>
      parseCcspConfig(createBase64Config({ ...validConfig, clientId: "" })),
    ).toThrow(/clientId is required/);
    expect(() => parseCcspConfig("CCSP:not-json")).toThrow(
      /CCSP auth failed: failed to parse config/,
    );
    expect(() =>
      parseCcspConfig(
        createBase64Config({ ...validConfig, tokenUrl: "not-a-url" }),
      ),
    ).toThrow(/tokenUrl is not a valid URL/);
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

  test("rejects unsupported authType and HTTP errors", async () => {
    const mockFetch: FetchOperations = {
      fetch: async () =>
        ({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          text: async () => "nope",
        }) as unknown as Response,
    };

    await expect(
      getCcspAccessToken({ ...validConfig, authType: "basic" }, mockFetch),
    ).rejects.toThrow(/unsupported auth type/);

    await expect(getCcspAccessToken(validConfig, mockFetch)).rejects.toThrow(
      /CCSP auth failed: 401/,
    );
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

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "CCSP auth failed: response is missing access_token",
    );
    expect((error as Error).message).not.toContain("do-not-leak");
  });
});
