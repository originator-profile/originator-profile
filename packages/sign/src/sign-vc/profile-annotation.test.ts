import { generateKey } from "@originator-profile/cryptography";
import {
  JapaneseExistencePA,
  ProfileAnnotation,
} from "@originator-profile/model";
import { signJwtVc } from "@originator-profile/securing-mechanism";
import { addYears, getUnixTime } from "date-fns";
import { decodeJwt, decodeProtectedHeader } from "jose";
import { describe, expect, test } from "vitest";

describe("ProfileAnnotation", () => {
  test("sign an AdvertisingQualityCertificate PA", async () => {
    const issuedAt = new Date();
    const expiredAt = addYears(new Date(), 10);
    const adCert: ProfileAnnotation = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "ProfileAnnotation"],
      issuer: "dns:adcert.exp.originator-profile.org",
      credentialSubject: {
        id: "dns:pa-holder.example.jp",
        type: "AdvertisingQualityCertificate",
        verifier: "架空広告監査機構",
        annotation: {
          id: "urn:uuid:8029ece0-b327-4a7e-b586-3e442cb82d92",
          type: "ProfileAnnotationPolicy",
          name: "架空広告認証センター ブランドセーフティ認証",
          description:
            "この事業者は、広告主のブランド価値を毀損するような違法、不当なサイト、コンテンツ、アプリケーションへの広告掲載を防ぐ対策を実施しています。",
          ref: "https://adcert.exp.originator-profile.org/",
        },
      },
      validFrom: "2022-03-31T15:00:00Z",
      validUntil: "2024-03-31T14:59:59Z",
    };
    const { publicKey, privateKey } = await generateKey();
    const jwt = await signJwtVc(adCert, privateKey, { issuedAt, expiredAt });
    expect(decodeProtectedHeader(jwt).kid).toBe(publicKey.kid);
    const valid = decodeJwt(jwt);
    expect(valid).toStrictEqual({
      iss: adCert.issuer,
      iat: getUnixTime(issuedAt),
      exp: getUnixTime(expiredAt),
      sub: adCert.credentialSubject.id,
      ...adCert,
    });
  });

  test("sign a Japanese existence PA", async () => {
    const issuedAt = new Date();
    const expiredAt = addYears(new Date(), 10);
    const pa: JapaneseExistencePA = {
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
          id: "urn:uuid:def09cbd-6e8e-4c73-856d-5e00dffde643",
          type: "ProfileAnnotationPolicy",
          name: "架空組織実在性検証局 実在証明",
          description:
            "この組織は、法人登記の照会等により組織が実在していることが確認できました。",
          ref: "https://ovac.exp.originator-profile.org/",
        },
      },
    };
    const { publicKey, privateKey } = await generateKey();
    const jwt = await signJwtVc(pa, privateKey, { issuedAt, expiredAt });
    expect(decodeProtectedHeader(jwt).kid).toBe(publicKey.kid);
    const valid = decodeJwt(jwt);
    expect(valid).toStrictEqual({
      iss: pa.issuer,
      iat: getUnixTime(issuedAt),
      exp: getUnixTime(expiredAt),
      sub: pa.credentialSubject.id,
      ...pa,
    });
  });
});
