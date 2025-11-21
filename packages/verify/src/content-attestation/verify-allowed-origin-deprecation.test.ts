import { generateKey, LocalKeys } from "@originator-profile/cryptography";
import { ContentAttestation } from "@originator-profile/model";
import { signJwtVc } from "@originator-profile/securing-mechanism";
import { addYears, fromUnixTime, getUnixTime } from "date-fns";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  MockInstance,
} from "vitest";
import { opId } from "../helper";
import { CaVerifier } from "./verify-content-attestation";

const issuedAt = fromUnixTime(getUnixTime(new Date()));
const expiredAt = addYears(issuedAt, 10);
const signOptions = { issuedAt, expiredAt };
const caIssuer = opId.originator;

describe("allowedOrigin deprecation 警告", async () => {
  const issuer = await generateKey();
  let consoleWarnSpy: MockInstance<typeof console.warn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  test("allowedOrigin を使用した CA の検証時に deprecation 警告が表示される", async () => {
    // allowedOrigin を使用した AdvertisementCA (OnlineAd)
    const adWithAllowedOrigin: ContentAttestation = {
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
      allowedOrigin: ["https://www.example.org"],
      target: [],
    };

    const signedAd = await signJwtVc(
      adWithAllowedOrigin,
      issuer.privateKey,
      signOptions,
    );

    const verifier = CaVerifier(
      signedAd,
      LocalKeys({ keys: [issuer.publicKey] }),
      caIssuer,
      new URL("https://www.example.org/"),
    );

    await verifier();

    // console.warn が1回呼ばれ、適切な警告メッセージが表示されることを確認
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[OP Warning] allowedOrigin is deprecated in Content Attestation and will be removed after September 2026. " +
        "Please use allowedUrl instead. " +
        "See: https://docs.originator-profile.org/",
    );
  });

  test("allowedUrl を使用した CA の検証時には警告が表示されない", async () => {
    // allowedUrl を使用した ArticleCA
    const articleWithAllowedUrl: ContentAttestation = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "ContentAttestation"],
      issuer: caIssuer,
      credentialSubject: {
        id: "urn:uuid:test-article-456",
        type: "Article",
        headline: "テスト記事",
        description: "記事の説明",
      },
      allowedUrl: ["https://www.example.org/articles*"],
      target: [],
    };

    const signedArticle = await signJwtVc(
      articleWithAllowedUrl,
      issuer.privateKey,
      signOptions,
    );

    const verifier = CaVerifier(
      signedArticle,
      LocalKeys({ keys: [issuer.publicKey] }),
      caIssuer,
      new URL("https://www.example.org/articles/test"),
    );

    await verifier();

    // console.warn が呼ばれていないことを確認
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
