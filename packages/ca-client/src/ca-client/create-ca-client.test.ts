import type { UnsignedContentAttestation } from "@originator-profile/model";
import { afterEach, expect, test, vi } from "vitest";
import { createCaClient } from "./create-ca-client";
import type { CaServerSign } from "./sign-by-server";

const ccspConfig = Buffer.from(
  JSON.stringify({
    authType: "client_secret_post",
    clientId: "id",
    clientSec: "sec",
    tokenUrl: "https://auth.example/token",
  }),
).toString("base64");

const config = {
  endpoint: "https://ca.example.com",
  issuer: "dns:issuer.example",
  ccspConfig,
};

const uca = { issuer: "dns:issuer.example" } as UnsignedContentAttestation;

const existingPayload = (): Record<string, unknown> => ({
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  type: ["VerifiableCredential", "ContentAttestation"],
  issuer: "dns:old-issuer.example.com",
  credentialSubject: {
    id: "urn:uuid:existing-id",
    type: "Article",
    headline: "Existing headline",
  },
  allowedUrl: ["https://example.com/ja-JP/about(/?)"],
  target: [
    {
      type: "TextTargetIntegrity",
      cssSelector: "main",
      integrity: "sha256-existing",
    },
  ],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubAccessToken = (accessToken: string) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ access_token: accessToken, expires_in: 3600 }),
          { status: 200 },
        ),
    ),
  );
};

test("createCaClient: returns config, sign, and reSign (tokenManager is not public)", () => {
  const client = createCaClient(config);

  expect(client.config.issuer).toBe("dns:issuer.example");
  expect(typeof client.sign).toBe("function");
  expect(typeof client.reSign).toBe("function");
  expect("tokenManager" in client).toBe(false);
});

test("createCaClient: sign delegates to signByServer with the injected sign function", async () => {
  stubAccessToken("tok-1");

  let captured:
    | { uca: UnsignedContentAttestation; accessToken: string; endpoint: string }
    | undefined;
  const sign: CaServerSign = async (received, { accessToken, endpoint }) => {
    captured = { uca: received, accessToken, endpoint };
    return "jwt-1";
  };

  const result = await createCaClient(config, { sign }).sign(uca);

  expect(result).toBe("jwt-1");
  expect(captured).toEqual({
    uca,
    accessToken: "tok-1",
    endpoint: "https://ca.example.com",
  });
});

test("createCaClient: reSign delegates to signByServer with the config issuer", async () => {
  stubAccessToken("tok-1");

  let captured: UnsignedContentAttestation | undefined;
  const sign: CaServerSign = async (received) => {
    captured = received;
    return "renewed-jwt";
  };

  const result = await createCaClient(config, { sign }).reSign(
    existingPayload(),
    "public/cas/en-US.about.cas.json",
  );

  expect(result).toBe("renewed-jwt");
  expect(captured?.issuer).toBe("dns:issuer.example");
  expect(captured?.credentialSubject?.id).toBe("urn:uuid:existing-id");
  expect(captured?.target?.[0]?.integrity).toBe("sha256-existing");
});
