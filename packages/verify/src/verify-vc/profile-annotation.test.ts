import { generateKey, LocalKeys } from "@originator-profile/cryptography";
import {
  JapaneseExistencePA,
  ProfileAnnotation,
} from "@originator-profile/model";
import {
  JwtVcVerifier,
  signJwtVc,
  VcValidator,
  VerifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import { addYears } from "date-fns";
import { describe, expect, test } from "vitest";

const VERIFIER_ID = "dns:pa-issuer.example.org";
const issuedAt = new Date();
const expiredAt = addYears(new Date(), 10);

const existencePA = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    { "@language": "ja" },
  ],
  type: ["VerifiableCredential", "ProfileAnnotation"],
  issuer: "dns:pa-issuer.example.org",
  credentialSubject: {
    id: "dns:pa-holder.example.jp",
    type: "JP-OrganizationExistenceCertificate",
    name: "○○新聞社 (※開発用サンプル)",
    corporateName: "○○新聞社 (※開発用サンプル)",
    corporateNumber: "0000000000000",
    postalCode: "000-0000",
    addressCountry: "JP",
    addressRegion: "東京都",
    addressLocality: "千代田区",
    streetAddress: "○○○",
    annotation: {
      id: "urn:uuid:5374a35f-57ce-43fd-84c3-2c9b0163e3df",
      type: "ProfileAnnotationPolicy",
      name: "法人番号システムWeb-API",
      description: "blah blah blah",
      ref: "https://www.houjin-bangou.nta.go.jp/",
    },
  },
} as const satisfies JapaneseExistencePA;

const adQualityPA = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    { "@language": "ja" },
  ],
  type: ["VerifiableCredential", "ProfileAnnotation"],
  issuer: "dns:pa-issuer.example.org",
  credentialSubject: {
    id: "dns:pa-holder.example.jp",
    type: "AdvertisingQualityCertificate",
    description:
      "この事業者は、広告主のブランド価値を毀損するような違法、不当なサイト、コンテンツ、アプリケーションへの広告掲載を防ぐ対策を実施しています。",
    image: {
      id: "https://example.com/certification-mark.svg",
      digestSRI: "sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=",
    },
    verifier: "架空広告監査機構",
    annotation: {
      id: "urn:uuid:2a12a385-fd1c-48e6-acd8-176c0c5e95ea",
      type: "ProfileAnnotationPolicy",
      name: "架空広告認証センター ブランドセーフティ認証",
      description: "blah blah blah",
      ref: "https://adcert.exp.originator-profile.org/",
    },
  },
  validFrom: "2022-03-31T15:00:00Z",
  validUntil: "2024-03-31T14:59:59Z",
} as const satisfies ProfileAnnotation;

describe("ProfileAnnotation", () => {
  test("組織実在 PA の検証に成功", async () => {
    const { publicKey, privateKey } = await generateKey();
    const keys = LocalKeys({ keys: [publicKey] });
    const validator =
      VcValidator<VerifiedJwtVc<JapaneseExistencePA>>(JapaneseExistencePA);
    const verifier = JwtVcVerifier(keys, VERIFIER_ID, validator);
    const jwt = await signJwtVc(existencePA, privateKey, {
      issuedAt,
      expiredAt,
    });
    const result = await verifier(jwt);
    expect(result).not.toBeInstanceOf(Error);
    // @ts-expect-error assert
    expect(result.doc).toStrictEqual(existencePA);
  });

  test("広告品質認証 PA の検証に成功", async () => {
    const { publicKey, privateKey } = await generateKey();
    const keys = LocalKeys({ keys: [publicKey] });
    const validator =
      VcValidator<VerifiedJwtVc<ProfileAnnotation>>(ProfileAnnotation);
    const verifier = JwtVcVerifier(keys, VERIFIER_ID, validator);
    const jwt = await signJwtVc(adQualityPA, privateKey, {
      issuedAt,
      expiredAt,
    });
    const result = await verifier(jwt);
    expect(result).not.toBeInstanceOf(Error);
    // @ts-expect-error assert
    expect(result.doc).toStrictEqual(adQualityPA);
  });
});
