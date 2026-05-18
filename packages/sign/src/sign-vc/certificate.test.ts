import { generateKey } from "@originator-profile/cryptography";
import {
  Certificate,
  JapaneseExistenceCertificate,
} from "@originator-profile/model";
import { signJwtVc } from "@originator-profile/securing-mechanism";
import { addYears, getUnixTime } from "date-fns";
import { decodeJwt, decodeProtectedHeader } from "jose";
import { describe, expect, test } from "vitest";

describe("Certificate", () => {
  test("sign an AdvertisingQualityCertificate", async () => {
    const issuedAt = new Date();
    const expiredAt = addYears(new Date(), 10);
    const adCert: Certificate = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "Certificate"],
      issuer: "dns:pa-issuer.example.org",
      credentialSubject: {
        id: "dns:pa-holder.example.jp",
        type: "CertificateProperties",
        description:
          "この事業者は、広告主のブランド価値を毀損するような違法、不当なサイト、コンテンツ、アプリケーションへの広告掲載を防ぐ対策を実施しています。",
        image: {
          id: "https://example.com/certification-mark.svg",
          digestSRI: "sha256-Upwn7gYMuRmJlD1ZivHk876vXHzokXrwXj50VgfnMnY=",
        },
        certifier: "架空広告認証センター",
        verifier: "架空広告監査機構",
        certificationSystem: {
          id: "urn:uuid:2a12a385-fd1c-48e6-acd8-176c0c5e95ea",
          type: "CertificationSystem",
          name: "架空広告認証センター ブランドセーフティ認証",
          description: "blah blah blah",
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

  test("sign a 日本新聞協会所属 certificate", async () => {
    const issuedAt = new Date();
    const expiredAt = addYears(new Date(), 10);
    const jppressnet: Certificate = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "Certificate"],
      issuer: "dns:pa-issuer.example.org",
      credentialSubject: {
        id: "dns:pa-holder.example.jp",
        description: "この事業者は、日本新聞協会に所属しています。",
        type: "CertificateProperties",
        certificationSystem: {
          id: "urn:uuid:14270f8f-9f1c-4f89-9fa4-8c93767a8404",
          type: "CertificationSystem",
          name: "日本新聞社協会 所属社",
          description:
            "一般社団法人日本新聞協会は、報道機関の倫理水準の向上を図ることで、健全な民主主義の発展に寄与することを目的とする団体です。報道機関が果たすべき責務と守るべき倫理について「新聞倫理綱領」を制定し、加盟社にこの綱領を順守することを求めています。加盟社は全国の新聞、通信、放送計１２２社（２０２４年５月１日現在）で、日々、正確で公正な記事と責任ある論評の発信に努めています。",
          ref: "https://www.pressnet.or.jp/",
        },
      },
      validFrom: "2022-03-31T15:00:00Z",
      validUntil: "2024-03-31T14:59:59Z",
    };
    const { publicKey, privateKey } = await generateKey();
    const jwt = await signJwtVc(jppressnet, privateKey, {
      issuedAt,
      expiredAt,
    });
    expect(decodeProtectedHeader(jwt).kid).toBe(publicKey.kid);
    const valid = decodeJwt(jwt);
    expect(valid).toStrictEqual({
      iss: jppressnet.issuer,
      iat: getUnixTime(issuedAt),
      exp: getUnixTime(expiredAt),
      sub: jppressnet.credentialSubject.id,
      ...jppressnet,
    });
  });

  test("sign a 実在性確認 certificate", async () => {
    const issuedAt = new Date();
    const expiredAt = addYears(new Date(), 10);
    const certificate: JapaneseExistenceCertificate = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "Certificate"],
      issuer: "dns:pa-issuer.example.org",
      credentialSubject: {
        id: "dns:pa-holder.example.jp",
        type: "JP-OrganizationExistenceCertificate",
        addressCountry: "JP",
        name: "○○新聞社 (※開発用サンプル)",
        corporateName: "○○新聞社 (※開発用サンプル)",
        corporateNumber: "0000000000000",
        postalCode: "000-0000",
        addressRegion: "東京都",
        addressLocality: "千代田区",
        streetAddress: "○○○",
        certificationSystem: {
          id: "urn:uuid:5374a35f-57ce-43fd-84c3-2c9b0163e3df",
          type: "CertificationSystem",
          name: "法人番号システムWeb-API",
          description: "blah blah blah",
          ref: "https://www.houjin-bangou.nta.go.jp/",
        },
      },
    };
    const { publicKey, privateKey } = await generateKey();
    const jwt = await signJwtVc(certificate, privateKey, {
      issuedAt,
      expiredAt,
    });
    expect(decodeProtectedHeader(jwt).kid).toBe(publicKey.kid);
    const valid = decodeJwt(jwt);
    expect(valid).toStrictEqual({
      iss: certificate.issuer,
      iat: getUnixTime(issuedAt),
      exp: getUnixTime(expiredAt),
      sub: certificate.credentialSubject.id,
      ...certificate,
    });
  });
});
