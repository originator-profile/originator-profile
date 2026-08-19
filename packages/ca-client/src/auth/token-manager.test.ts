import { expect, test, vi } from "vitest";
import type { CcspAuthConfig, CcspTokenResponse } from "./ccsp-auth";
import { TokenManager } from "./token-manager";

const createJwtToken = (payload: Record<string, unknown>): string => {
  const encodedHeader = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  return `${encodedHeader}.${encodedPayload}.signature`;
};

const createTestConfig = (): CcspAuthConfig => ({
  authType: "client_secret_post",
  clientId: "test-client-id",
  clientSec: "test-client-secret",
  tokenUrl: "https://api.example.com/token",
});

const BASE_TIME = 1_000_000;

const createManager = ({
  bufferSeconds = 300,
  responses,
}: {
  bufferSeconds?: number;
  responses?: (callCount: number) => Promise<CcspTokenResponse>;
} = {}) => {
  const clock = { time: BASE_TIME };
  let callCount = 0;
  const getCcspAccessToken = vi.fn(async () => {
    callCount += 1;
    if (responses) {
      return await responses(callCount);
    }
    return {
      access_token: createJwtToken({ exp: clock.time + 3600 }),
      expires_in: 3600,
    };
  });
  const manager = new TokenManager(createTestConfig(), bufferSeconds, {
    getCcspAccessToken,
    now: () => clock.time,
  });
  return { manager, clock, getCcspAccessToken };
};

test("TokenManager: fetches once and caches", async () => {
  const { manager, getCcspAccessToken } = createManager({
    responses: async (callCount) => ({
      access_token: `token-${callCount}`,
      expires_in: 3600,
    }),
  });

  const token1 = await manager.getAccessToken();
  const token2 = await manager.getAccessToken();

  expect(token1).toBe(token2);
  expect(getCcspAccessToken).toHaveBeenCalledTimes(1);
});

test("TokenManager: refreshes when the token is near expiry", async () => {
  const { manager, clock, getCcspAccessToken } = createManager({
    responses: async (callCount) => ({
      access_token: `token-${callCount}`,
      expires_in: 3600,
    }),
  });

  const token1 = await manager.getAccessToken();
  clock.time += 3600 - 200;
  const token2 = await manager.getAccessToken();

  expect(getCcspAccessToken).toHaveBeenCalledTimes(2);
  expect(token1).not.toBe(token2);
});

test("TokenManager: coalesces concurrent requests into one fetch", async () => {
  const { manager, getCcspAccessToken } = createManager({
    responses: async (callCount) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10);
      });
      return {
        access_token: `token-${callCount}`,
        expires_in: 3600,
      };
    },
  });

  const [token1, token2, token3] = await Promise.all([
    manager.getAccessToken(),
    manager.getAccessToken(),
    manager.getAccessToken(),
  ]);

  expect(token1).toBe(token2);
  expect(token2).toBe(token3);
  expect(getCcspAccessToken).toHaveBeenCalledTimes(1);
});

test("TokenManager: refreshToken and clearCache", async () => {
  const { manager, getCcspAccessToken } = createManager({
    responses: async (callCount) => ({
      access_token: `token-${callCount}`,
      expires_in: 3600,
    }),
  });

  const token1 = await manager.getAccessToken();
  const token2 = await manager.refreshToken();
  expect(token1).not.toBe(token2);

  manager.clearCache();
  await manager.getAccessToken();
  expect(getCcspAccessToken).toHaveBeenCalledTimes(3);
});

test("TokenManager: isTokenValid", async () => {
  const { manager, clock } = createManager();

  expect(manager.isTokenValid()).toBe(false);
  await manager.getAccessToken();
  expect(manager.isTokenValid()).toBe(true);
  clock.time += 3600;
  expect(manager.isTokenValid()).toBe(false);
});
