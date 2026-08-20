import type { UnsignedContentAttestation } from "@originator-profile/model";
import { expect, test, vi } from "vitest";
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

test("signByCaServer: POSTs with Bearer auth and returns a JWT", async () => {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(["jwt-1", "jwt-2"]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );

  const jwt = await signByCaServer(uca, {
    endpoint,
    accessToken: "tok",
    fetchOps: { fetch: fetchMock },
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
  const error = await signByCaServer(uca, {
    endpoint,
    accessToken: "tok",
    fetchOps: {
      fetch: async () =>
        new Response("token expired", {
          status: 401,
          statusText: "Unauthorized",
        }),
    },
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

test("signByCaServer: does not wrap document fetch failures as validation errors", async () => {
  const cause = new TypeError("Failed to fetch");

  const error = await signByCaServer(
    {
      ...uca,
      target: [
        {
          type: "TextTargetIntegrity",
          cssSelector: "main",
          content: "https://example.com/article",
        },
      ],
    },
    {
      endpoint,
      accessToken: "tok",
      documentProvider: async () => {
        throw new CaClientError("Failed to fetch document: Failed to fetch", {
          code: CaClientErrorCode.Http,
          cause,
        });
      },
      fetchOps: { fetch: vi.fn() },
    },
  ).then(
    () => null,
    (e: unknown) => e,
  );

  expect(error).toBeInstanceOf(CaClientError);
  expect(error).toMatchObject({
    message: "Failed to fetch document: Failed to fetch",
    code: CaClientErrorCode.Http,
    cause,
  });
});

test("signByCaServer: distinguishes empty responses from JSON that is not a JWT", async () => {
  await expect(
    signByCaServer(uca, {
      endpoint,
      accessToken: "tok",
      fetchOps: { fetch: async () => new Response("", { status: 200 }) },
    }),
  ).rejects.toMatchObject({
    message: "CA signing failed: empty response",
    code: CaClientErrorCode.Response,
  });

  await expect(
    signByCaServer(uca, {
      endpoint,
      accessToken: "tok",
      fetchOps: {
        fetch: async () =>
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      },
    }),
  ).rejects.toMatchObject({
    message: "CA signing failed: response did not contain a JWT",
    code: CaClientErrorCode.Response,
  });
});
