import { generateKey, LocalKeys } from "@originator-profile/cryptography";
import { ContentAttestation, Jwk } from "@originator-profile/model";
import { signJwtVc, VcValidator } from "@originator-profile/securing-mechanism";
import { addYears, fromUnixTime, getUnixTime } from "date-fns";
import { diffApply } from "just-diff-apply";
import {
  type MockInstance,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { createIntegrityMetadata } from "websri";
import { verifyIntegrity } from "../integrity";
import { CaInvalid, CaVerifyFailed } from "./errors";
import { VerifiedCa } from "./types";
import { CaVerifier } from "./verify-content-attestation";

const issuedAt = fromUnixTime(getUnixTime(new Date()));
const expiredAt = addYears(issuedAt, 10);
const signOptions = { issuedAt, expiredAt };
const toVerifyResult = (
  ca: ContentAttestation,
  jwt: string,
  verificationKey: Jwk,
): VerifiedCa => ({
  doc: ca,
  issuedAt,
  expiredAt,
  algorithm: "ES256",
  mediaType: "application/vc+jwt",
  source: jwt,
  verificationKey,
  validated: true,
});
const patch = <T extends object>(...args: Parameters<typeof diffApply<T>>) => {
  const [source, diff] = args;
  const patched = structuredClone(source);
  diffApply(patched, diff);
  return patched;
};
const caIssuer = "dns:ca-issuer.example.org";
const caId = "urn:uuid:78550fa7-f846-4e0f-ad5c-8d34461cb95b";
const caUrl = new URL("https://www.example.org/example");

const integrityMetadata = await createIntegrityMetadata(
  "sha256",
  await new Response("ok").arrayBuffer(),
);

document.body.textContent = "ok";

const ca: ContentAttestation = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
  ],
  type: ["VerifiableCredential", "ContentAttestation"],
  issuer: caIssuer,
  credentialSubject: {
    id: caId,
    type: "anCA",
  },
  target: [
    {
      type: "TextTargetIntegrity",
      cssSelector: "body",
      integrity: integrityMetadata.toString(),
    },
  ],
};

describe("Content Attestationの検証", async () => {
  const validator = VcValidator<VerifiedCa>(ContentAttestation);
  const issuer = await generateKey();
  const signedCa = await signJwtVc(ca, issuer.privateKey, signOptions);

  test("Content Attestationの検証に成功", async () => {
    const verifier = CaVerifier(
      signedCa,
      LocalKeys({ keys: [issuer.publicKey] }),
      caIssuer,
      caUrl,
      verifyIntegrity,
      validator,
    );
    const result = await verifier();
    expect(result).not.instanceOf(CaInvalid);
    expect(result).not.instanceOf(CaVerifyFailed);
    expect(result).toStrictEqual(
      toVerifyResult(ca, signedCa, issuer.publicKey),
    );
  });

  test("Content Attestationの復号に失敗", async () => {
    const verifier = CaVerifier(
      "",
      LocalKeys({ keys: [issuer.publicKey] }),
      caIssuer,
      caUrl,
      verifyIntegrity,
      validator,
    );
    const result = await verifier();
    expect(result).instanceOf(CaVerifyFailed);
  });

  test("Content Attestationの検証に失敗", async () => {
    const verifier = CaVerifier(
      signedCa,
      LocalKeys({ keys: [issuer.publicKey] }),
      "evil-issuer.example.org",
      caUrl,
      verifyIntegrity,
      validator,
    );
    const result = await verifier();
    expect(result).instanceOf(CaVerifyFailed);
  });

  test("Content Attestationの検証でスキーマにあっていない", async () => {
    const invalidCa = patch(ca, [
      {
        op: "replace",
        path: ["type"],
        value: ["InvalidCredential"],
      },
    ]);
    const signedInvalidCa = await signJwtVc(
      invalidCa,
      issuer.privateKey,
      signOptions,
    );
    const verifier = CaVerifier(
      signedInvalidCa,
      LocalKeys({ keys: [issuer.publicKey] }),
      caIssuer,
      caUrl,
      verifyIntegrity,
      validator,
    );
    const result = await verifier();
    expect(result).instanceOf(CaInvalid);
  });

  test("Content Attestationの検証でallowedUrlとallowedOriginが同時に指定されている", async () => {
    const invalidCa = patch(ca, [
      {
        op: "add",
        path: ["allowedUrl"],
        value: ["https://example.org"],
      },
      {
        op: "add",
        path: ["allowedOrigin"],
        value: ["https://example.org"],
      },
    ]);
    const signedInvalidCa = await signJwtVc(
      invalidCa,
      issuer.privateKey,
      signOptions,
    );
    const verifier = CaVerifier(
      signedInvalidCa,
      LocalKeys({ keys: [issuer.publicKey] }),
      caIssuer,
      caUrl,
      verifyIntegrity,
      validator,
    );
    const result = await verifier();
    expect(result).instanceOf(CaInvalid);
  });

  describe("image digestSRI検証 (2027年まではwarn扱い)", () => {
    let warnSpy: MockInstance;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    test("digestSRIがない場合、warnが出るが検証は成功する", async () => {
      const signed = await signJwtVc(
        patch(ca, [
          {
            op: "add",
            path: ["credentialSubject", "image"],
            value: { id: "https://example.org/image.png" },
          },
        ]),
        issuer.privateKey,
        signOptions,
      );

      const result = await CaVerifier(
        signed,
        LocalKeys({ keys: [issuer.publicKey] }),
        caIssuer,
        caUrl,
        verifyIntegrity,
        validator,
      )();

      expect(result).not.instanceOf(CaInvalid);
      expect(result).not.instanceOf(CaVerifyFailed);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("digestSRI is missing"),
      );
    });

    test("digestSRIが不正な場合、warnが出るが検証は成功する", async () => {
      const signed = await signJwtVc(
        patch(ca, [
          {
            op: "add",
            path: ["credentialSubject", "image"],
            value: {
              id: "https://example.org/image.png",
              digestSRI: "sha256-invalid",
            },
          },
        ]),
        issuer.privateKey,
        signOptions,
      );

      const result = await CaVerifier(
        signed,
        LocalKeys({ keys: [issuer.publicKey] }),
        caIssuer,
        caUrl,
        verifyIntegrity,
        validator,
      )();

      expect(result).not.instanceOf(CaInvalid);
      expect(result).not.instanceOf(CaVerifyFailed);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("digestSRI verification failed"),
      );
    });
  });
});
