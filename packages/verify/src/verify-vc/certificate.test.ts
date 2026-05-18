import { generateKey, LocalKeys } from "@originator-profile/cryptography";
import {
  Certificate,
  JapaneseExistenceCertificate,
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
const existenceCertificate = {
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
} as const satisfies JapaneseExistenceCertificate;

const adQualityCertificate = {
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
      digestSRI: "sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=",
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
} as const satisfies Certificate;

const jppressnetCertificate = {
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
    description: "blah blah blah",
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
} as const satisfies Certificate;

describe("Certificate", () => {
  test("実在性確認証明書の検証に成功", async () => {
    const { publicKey, privateKey } = await generateKey();
    const keys = LocalKeys({ keys: [publicKey] });
    const validator = VcValidator<VerifiedJwtVc<JapaneseExistenceCertificate>>(
      JapaneseExistenceCertificate,
    );
    const verifier = JwtVcVerifier(keys, VERIFIER_ID, validator);
    const jwt = await signJwtVc(existenceCertificate, privateKey, {
      issuedAt,
      expiredAt,
    });
    const result = await verifier(jwt);
    expect(result).not.toBeInstanceOf(Error);
    // @ts-expect-error assert
    expect(result.doc).toStrictEqual(existenceCertificate);
  });

  test("広告品質認証証明書の検証に成功", async () => {
    const { publicKey, privateKey } = await generateKey();
    const keys = LocalKeys({ keys: [publicKey] });
    const validator = VcValidator<VerifiedJwtVc<Certificate>>(Certificate);
    const verifier = JwtVcVerifier(keys, VERIFIER_ID, validator);
    const jwt = await signJwtVc(adQualityCertificate, privateKey, {
      issuedAt,
      expiredAt,
    });
    const result = await verifier(jwt);
    expect(result).not.toBeInstanceOf(Error);
    // @ts-expect-error assert
    expect(result.doc).toStrictEqual(adQualityCertificate);
  });

  test("日本新聞協会所属証明書の検証に成功", async () => {
    const { publicKey, privateKey } = await generateKey();
    const keys = LocalKeys({ keys: [publicKey] });
    const validator = VcValidator<VerifiedJwtVc<Certificate>>(Certificate);
    const verifier = JwtVcVerifier(keys, VERIFIER_ID, validator);
    const jwt = await signJwtVc(jppressnetCertificate, privateKey, {
      issuedAt,
      expiredAt,
    });
    const result = await verifier(jwt);
    expect(result).not.toBeInstanceOf(Error);
    // @ts-expect-error assert
    expect(result.doc).toStrictEqual(jppressnetCertificate);
  });
});
