import type { UnsignedContentAttestation } from "@originator-profile/model";
import { expect, test } from "vitest";
import { reSign } from "./re-sign";
import type { CaServerSign } from "./sign-by-server";

const basePayload = (): Record<string, unknown> => ({
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

test("reSign: re-signs an existing payload and keeps integrity and id", async () => {
  let captured: UnsignedContentAttestation | undefined;
  const sign: CaServerSign = async (uca) => {
    captured = uca;
    return "renewed-jwt";
  };

  const result = await reSign(basePayload(), {
    source: "public/cas/en-US.about.cas.json",
    endpoint: "https://ca.example.com",
    getAccessToken: async () => "tok",
    sign,
  });

  expect(result).toBe("renewed-jwt");
  expect(captured?.target?.[0]?.integrity).toBe("sha256-existing");
  expect(
    (captured?.target?.[0] as Record<string, unknown>)?.content,
  ).toBeUndefined();
  expect(captured?.credentialSubject?.id).toBe("urn:uuid:existing-id");
});

test("reSign: overrides the payload issuer with the issuer option", async () => {
  let captured: UnsignedContentAttestation | undefined;
  const sign: CaServerSign = async (uca) => {
    captured = uca;
    return "renewed-jwt";
  };

  await reSign(basePayload(), {
    source: "src",
    issuer: "dns:new-issuer.example.com",
    endpoint: "https://ca.example.com",
    getAccessToken: async () => "tok",
    sign,
  });

  expect(captured?.issuer).toBe("dns:new-issuer.example.com");
});
