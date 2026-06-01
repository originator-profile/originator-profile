import { Certificate } from "@originator-profile/verify";
import { describe, expect, test } from "vitest";
import { isDisplayableProfileAnnotation } from "./profile-annotation";

describe("isDisplayableProfileAnnotation", () => {
  test("ProfileAnnotationIssuerRegistration は表示対象外", () => {
    const registration: Certificate = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja-JP" },
      ],
      type: ["VerifiableCredential", "ProfileAnnotation"],
      issuer: "dns:op-registry.example.org",
      credentialSubject: {
        id: "dns:pa-issuer.example.org",
        type: "ProfileAnnotationIssuerRegistration",
        name: "Profile Annotation Issuer 登録証",
        description: "登録証",
        annotationIssuerName: "架空組織実在性検証局",
        annotationScheme: ["urn:uuid:def09cbd-6e8e-4c73-856d-5e00dffde643"],
        annotation: {
          id: "urn:uuid:5927e1da-e422-47c8-a5b8-efa6f5a45dd7",
          type: "ProfileAnnotationPolicy",
          name: "OP レジストリ Profile Annotation Issuer 登録制度",
          ref: "https://op-registry.example.org/profile-annotation-issuer-registration",
        },
      },
    };
    expect(isDisplayableProfileAnnotation(registration)).toBe(false);
  });

  test("通常の Profile Annotation (組織実在 PA) は表示対象", () => {
    const existence: Certificate = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja-JP" },
      ],
      type: ["VerifiableCredential", "ProfileAnnotation"],
      issuer: "dns:certifier.example.org",
      credentialSubject: {
        id: "dns:holder.example.org",
        type: "JP-OrganizationExistenceCertificate",
        corporateName: "○○新聞社",
        corporateNumber: "0000000000000",
        postalCode: "000-0000",
        addressCountry: "JP",
        addressRegion: "東京都",
        addressLocality: "千代田区",
        streetAddress: "○○○",
        annotation: {
          id: "urn:uuid:def09cbd-6e8e-4c73-856d-5e00dffde643",
          type: "ProfileAnnotationPolicy",
          name: "法人番号システムWeb-API",
          ref: "https://www.houjin-bangou.nta.go.jp/",
        },
      },
    };
    expect(isDisplayableProfileAnnotation(existence)).toBe(true);
  });

  test("旧 Certificate 形式 (certificationSystem 持ち) も表示対象", () => {
    const legacyCertificate: Certificate = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja-JP" },
      ],
      type: ["VerifiableCredential", "Certificate"],
      issuer: "dns:certifier.example.org",
      credentialSubject: {
        id: "dns:holder.example.org",
        type: "CertificateProperties",
        description: "Example Certificate",
        certificationSystem: {
          id: "urn:uuid:de5d6e80-10a5-404f-b4d3-e9f0e6926a21",
          type: "CertificationSystem",
          name: "Example Certification System",
          description: "Example Certification System Description",
        },
      },
    };
    expect(isDisplayableProfileAnnotation(legacyCertificate)).toBe(true);
  });
});
