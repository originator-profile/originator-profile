import { expect, test } from "vitest";
import {
  jwtPayloadToUnsignedCa,
  parseCasTokenFromFileContent,
} from "./cas-token";

test("parseCasTokenFromFileContent: returns the first JWT in the array", () => {
  const token = "header.payload.signature";
  expect(
    parseCasTokenFromFileContent(JSON.stringify([token]), "test.cas.json"),
  ).toBe(token);
});

test("parseCasTokenFromFileContent: throws on invalid format", () => {
  expect(() =>
    parseCasTokenFromFileContent(JSON.stringify({ notArray: true }), "x"),
  ).toThrow(/Invalid CAS: invalid file format/);
  expect(() =>
    parseCasTokenFromFileContent("{invalid", "src.cas.json"),
  ).toThrow(/Invalid CAS: failed to parse JSON in src\.cas\.json/);
});

test("jwtPayloadToUnsignedCa: builds an unsigned CA from the payload", () => {
  const payload = {
    iss: "dns:issuer.example",
    sub: "urn:uuid:1",
    iat: 1,
    exp: 2,
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
    ],
    type: ["VerifiableCredential", "ContentAttestation"],
    issuer: "dns:issuer.example",
    credentialSubject: { type: "Article", headline: "headline" },
    allowedUrl: ["https://example.com"],
    target: [{ type: "TextTargetIntegrity", integrity: "sha256-xxx" }],
  };

  expect(jwtPayloadToUnsignedCa(payload, "test.cas.json")).toEqual({
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
    ],
    type: ["VerifiableCredential", "ContentAttestation"],
    issuer: "dns:issuer.example",
    credentialSubject: { type: "Article", headline: "headline" },
    allowedUrl: ["https://example.com"],
    target: [{ type: "TextTargetIntegrity", integrity: "sha256-xxx" }],
  });
});

test("jwtPayloadToUnsignedCa: throws when required keys are missing and can override issuer", () => {
  expect(() =>
    jwtPayloadToUnsignedCa(
      { type: ["VerifiableCredential"], issuer: "dns:issuer.example" },
      "test.cas.json",
    ),
  ).toThrow(/missing required keys/);

  expect(() =>
    jwtPayloadToUnsignedCa(
      {
        "@context": [
          "https://www.w3.org/ns/credentials/v2",
          "https://originator-profile.org/ns/credentials/v1",
        ],
        type: ["VerifiableCredential", "ContentAttestation"],
        issuer: "dns:issuer.example",
        credentialSubject: null,
        allowedUrl: ["https://example.com"],
        target: [{ type: "TextTargetIntegrity", integrity: "sha256-xxx" }],
      },
      "test.cas.json",
    ),
  ).toThrow(/missing required keys.*credentialSubject/);

  const payload = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
    ],
    type: ["VerifiableCredential", "ContentAttestation"],
    issuer: "dns:jwt.example",
    credentialSubject: {
      type: "Article",
      id: "urn:uuid:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    },
    allowedUrl: ["https://example.com"],
    target: [{ type: "TextTargetIntegrity", integrity: "sha256-xxx" }],
  };

  expect(
    jwtPayloadToUnsignedCa(payload, "test.cas.json", {
      issuer: "dns:env.example",
    }).issuer,
  ).toBe("dns:env.example");
  expect(
    jwtPayloadToUnsignedCa(payload, "test.cas.json").credentialSubject.id,
  ).toBe("urn:uuid:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
});

test("jwtPayloadToUnsignedCa: throws with source when field types are invalid", () => {
  expect(() =>
    jwtPayloadToUnsignedCa(
      {
        "@context": ["https://www.w3.org/ns/credentials/v2"],
        type: ["VerifiableCredential", "ContentAttestation"],
        issuer: "dns:issuer.example",
        credentialSubject: { type: "Article" },
        allowedUrl: ["https://example.com"],
        target: [{ type: "TextTargetIntegrity" }],
      },
      "src/cas/en-US.about.cas.json",
    ),
  ).toThrow(
    /Invalid Content Attestation: invalid payload in src\/cas\/en-US\.about\.cas\.json/,
  );
});
