import type { UnsignedContentAttestation } from "@originator-profile/model";
import { afterEach, expect, test, vi } from "vitest";
import { CaClientError, CaClientErrorCode, isUnauthorized } from "../errors";
import { signByCaServer } from "./sign-by-ca-server";

const endpoint = "https://ca.example.com/attestations";

const uca = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
  ],
  type: ["VerifiableCredential", "ContentAttestation"],
  issuer: "dns:example.com",
  credentialSubject: {
    id: "https://example.com/ca/1",
    type: "Article",
    headline: "Test",
  },
  target: [
    {
      type: "TextTargetIntegrity",
      cssSelector: "main",
      integrity: "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    },
  ],
} as UnsignedContentAttestation;

afterEach(() => {
  vi.unstubAllGlobals();
});

test("signByCaServer: POSTs with Bearer auth and returns a JWT", async () => {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(["jwt-1", "jwt-2"]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const jwt = await signByCaServer(uca, {
    endpoint,
    accessToken: "tok",
  });

  expect(jwt).toBe("jwt-1");
  expect(fetchMock).toHaveBeenCalledWith(
    endpoint,
    expect.objectContaining({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer tok",
      },
    }),
  );
});

test("signByCaServer: throws so that isUnauthorized is true on 401", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("token expired", {
          status: 401,
          statusText: "Unauthorized",
        }),
    ),
  );

  const error = await signByCaServer(uca, {
    endpoint,
    accessToken: "tok",
  }).then(
    () => null,
    (e: unknown) => e,
  );

  expect(error).toBeInstanceOf(CaClientError);
  expect(error).toMatchObject({
    code: CaClientErrorCode.Http,
    status: 401,
  });
  expect(isUnauthorized(error)).toBe(true);
});

test("signByCaServer: distinguishes empty responses from JSON that is not a JWT", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("", { status: 200 })),
  );

  await expect(
    signByCaServer(uca, { endpoint, accessToken: "tok" }),
  ).rejects.toMatchObject({
    message: "CA signing failed: empty response",
    code: CaClientErrorCode.Response,
  });

  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );

  await expect(
    signByCaServer(uca, { endpoint, accessToken: "tok" }),
  ).rejects.toMatchObject({
    message: "CA signing failed: response did not contain a JWT",
    code: CaClientErrorCode.Response,
  });
});
