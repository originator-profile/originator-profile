import type { UnsignedContentAttestation } from "@originator-profile/model";
import { expect, test } from "vitest";
import { CaClientError, CaClientErrorCode } from "../errors";
import { signByServer, type CaServerSign } from "./sign-by-server";

const uca = {} as UnsignedContentAttestation;

test("signByServer: fetches a token and delegates to CA server signing", async () => {
  const calls: Array<{ accessToken: string }> = [];
  const sign: CaServerSign = async (_uca, { accessToken }) => {
    calls.push({ accessToken });
    return "jwt-1";
  };

  const result = await signByServer(uca, {
    endpoint: "https://ca.example.com",
    getAccessToken: async () => "tok-1",
    sign,
  });

  expect(result).toBe("jwt-1");
  expect(calls).toEqual([{ accessToken: "tok-1" }]);
});

test("signByServer: refreshes and retries once on 401", async () => {
  const calls: string[] = [];
  let refreshed = 0;
  const sign: CaServerSign = async (_uca, { accessToken }) => {
    calls.push(accessToken);
    if (calls.length === 1) {
      throw new CaClientError("CA signing failed: 401 Unauthorized: token expired", {
        code: CaClientErrorCode.Http,
        status: 401,
      });
    }
    return "jwt-2";
  };

  const result = await signByServer(uca, {
    endpoint: "https://ca.example.com",
    getAccessToken: async () => "tok-1",
    refreshAccessToken: async () => {
      refreshed += 1;
      return "tok-2";
    },
    sign,
  });

  expect(result).toBe("jwt-2");
  expect(calls).toEqual(["tok-1", "tok-2"]);
  expect(refreshed).toBe(1);
});

test("signByServer: does not refresh on non-401 errors", async () => {
  let refreshed = 0;
  const sign: CaServerSign = async () => {
    throw new CaClientError("CA signing failed: 500 Internal Server Error: ", {
      code: CaClientErrorCode.Http,
      status: 500,
    });
  };

  await expect(
    signByServer(uca, {
      endpoint: "https://ca.example.com",
      getAccessToken: async () => "tok-1",
      refreshAccessToken: async () => {
        refreshed += 1;
        return "tok-2";
      },
      sign,
    }),
  ).rejects.toThrow(/500/);
  expect(refreshed).toBe(0);
});

test("signByServer: rethrows 401 when refreshAccessToken is not provided", async () => {
  let count = 0;
  const sign: CaServerSign = async () => {
    count += 1;
    throw new CaClientError("CA signing failed: 401 Unauthorized: ", {
      code: CaClientErrorCode.Http,
      status: 401,
    });
  };

  await expect(
    signByServer(uca, {
      endpoint: "https://ca.example.com",
      getAccessToken: async () => "tok-1",
      sign,
    }),
  ).rejects.toThrow(/401/);
  expect(count).toBe(1);
});
