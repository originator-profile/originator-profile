import { generateKey, LocalKeys } from "@originator-profile/cryptography";
import { signJwtVc } from "@originator-profile/securing-mechanism";
import { addYears, fromUnixTime, getUnixTime } from "date-fns";
import { describe, expect, test } from "vitest";
import { opId } from "../helper";
import { CaInvalid, CaVerifyFailed } from "./errors";
import { CaVerifier } from "./verify-content-attestation";

const issuedAt = fromUnixTime(getUnixTime(new Date()));
const expiredAt = addYears(issuedAt, 10);
const signOptions = { issuedAt, expiredAt };
const caIssuer = opId.originator;
const url = new URL("https://www.example.org/articles/test");

const base = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    { "@language": "ja" },
  ],
  type: ["VerifiableCredential", "ContentAttestation"],
  issuer: caIssuer,
  credentialSubject: {
    id: "urn:uuid:test-ad-123",
    type: "OnlineAd",
    name: "テスト広告",
    description: "広告の説明",
  },
  target: [],
};

// NOTE: validator を渡さない。拡張機能などスキーマ検証をしない呼び出し元でも拒否されることを確かめる。
describe("allowedUrl の検証", async () => {
  const issuer = await generateKey();
  const verify = async <T extends typeof base>(vc: T) =>
    await CaVerifier(
      await signJwtVc(vc, issuer.privateKey, signOptions),
      LocalKeys({ keys: [issuer.publicKey] }),
      caIssuer,
      url,
    )();

  test("allowedOrigin を含む CA は無効", async () => {
    const result = await verify({
      ...base,
      allowedOrigin: ["https://www.example.org"],
    });
    expect(result).instanceOf(CaInvalid);
    expect(result).toHaveProperty(
      "message",
      "allowedOrigin is not allowed in Content Attestation. Use allowedUrl instead.",
    );
  });

  test("allowedUrl と allowedOrigin を両方含む CA は無効", async () => {
    const result = await verify({
      ...base,
      allowedUrl: ["https://www.example.org/articles*"],
      allowedOrigin: ["https://www.example.org"],
    });
    expect(result).instanceOf(CaInvalid);
    expect(result).toHaveProperty(
      "message",
      "allowedOrigin is not allowed in Content Attestation. Use allowedUrl instead.",
    );
  });

  test("allowedUrl を含まない CA は無効", async () => {
    const result = await verify(base);
    expect(result).instanceOf(CaInvalid);
    expect(result).toHaveProperty("message", "allowedUrl is required");
  });

  test("allowedUrl に一致しない URL では検証に失敗", async () => {
    const result = await verify({
      ...base,
      allowedUrl: ["https://www.example.org/other*"],
    });
    expect(result).instanceOf(CaVerifyFailed);
  });
});
