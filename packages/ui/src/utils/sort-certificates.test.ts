import { Certificate, getAnnotationPolicy } from "@originator-profile/verify";
import { describe, expect, test } from "vitest";
import sortCertificates from "./sort-certificates";

const makeCertificate = (id: string): Certificate => ({
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
      "@language": "ja",
    },
  ],
  type: ["VerifiableCredential", "Certificate"],
  issuer: "dns:localhost",
  credentialSubject: {
    id: "dns:localhost",
    type: "CertificateProperties",
    description: "Example Certificate",
    certificationSystem: {
      id: id,
      type: "CertificationSystem",
      name: "Example Certification System",
      description: "Example Certification System Description",
    },
  },
});

const makeProfileAnnotation = (id: string): Certificate => ({
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
      "@language": "ja",
    },
  ],
  type: ["VerifiableCredential", "ProfileAnnotation"],
  issuer: "dns:localhost",
  credentialSubject: {
    id: "dns:localhost",
    type: "AdvertisingQualityCertificate",
    annotation: {
      id: id,
      type: "ProfileAnnotationPolicy",
      name: "Example Profile Annotation Policy",
      description: "Example Profile Annotation Policy Description",
    },
  },
});

describe("sortCertificates", () => {
  test("既知のIDを優先度順に並び替える", () => {
    const input = [
      makeCertificate("urn:uuid:2dbf9afe-af9c-4c6a-b6df-70a9565fec5e"),
      makeCertificate("urn:uuid:def09cbd-6e8e-4c73-856d-5e00dffde643"),
      makeCertificate("urn:uuid:203a2553-f1a8-40ba-9df0-4e508aa8511d"),
    ];
    const result = sortCertificates(input);
    expect(result.map((c) => getAnnotationPolicy(c).id)).toEqual([
      "urn:uuid:def09cbd-6e8e-4c73-856d-5e00dffde643",
      "urn:uuid:203a2553-f1a8-40ba-9df0-4e508aa8511d",
      "urn:uuid:2dbf9afe-af9c-4c6a-b6df-70a9565fec5e",
    ]);
  });

  test("未知のIDは最後に配置される", () => {
    const input = [
      makeCertificate("urn:uuid:8029ece0-b327-4a7e-b586-3e442cb82d92"),
      makeCertificate("unknown"),
      makeCertificate("urn:uuid:85c92abe-4518-42bb-855d-dffeabfe4a38"),
    ];
    const result = sortCertificates(input);
    expect(result.map((c) => getAnnotationPolicy(c).id)).toEqual([
      "urn:uuid:8029ece0-b327-4a7e-b586-3e442cb82d92",
      "urn:uuid:85c92abe-4518-42bb-855d-dffeabfe4a38",
      "unknown",
    ]);
  });

  test("空配列を処理できる", () => {
    const result = sortCertificates([]);
    expect(result).toEqual([]);
  });

  test("annotation を持つ新形式 PA も並び替えできる", () => {
    const input = [
      makeProfileAnnotation("urn:uuid:8029ece0-b327-4a7e-b586-3e442cb82d92"),
      makeProfileAnnotation("urn:uuid:def09cbd-6e8e-4c73-856d-5e00dffde643"),
      makeProfileAnnotation("urn:uuid:203a2553-f1a8-40ba-9df0-4e508aa8511d"),
    ];
    const result = sortCertificates(input);
    expect(result.map((c) => getAnnotationPolicy(c).id)).toEqual([
      "urn:uuid:def09cbd-6e8e-4c73-856d-5e00dffde643",
      "urn:uuid:203a2553-f1a8-40ba-9df0-4e508aa8511d",
      "urn:uuid:8029ece0-b327-4a7e-b586-3e442cb82d92",
    ]);
  });

  test("旧 certificationSystem と新 annotation が混在しても並び替えできる", () => {
    const input = [
      makeCertificate("urn:uuid:8029ece0-b327-4a7e-b586-3e442cb82d92"),
      makeProfileAnnotation("urn:uuid:def09cbd-6e8e-4c73-856d-5e00dffde643"),
      makeCertificate("urn:uuid:2dbf9afe-af9c-4c6a-b6df-70a9565fec5e"),
    ];
    const result = sortCertificates(input);
    expect(result.map((c) => getAnnotationPolicy(c).id)).toEqual([
      "urn:uuid:def09cbd-6e8e-4c73-856d-5e00dffde643",
      "urn:uuid:2dbf9afe-af9c-4c6a-b6df-70a9565fec5e",
      "urn:uuid:8029ece0-b327-4a7e-b586-3e442cb82d92",
    ]);
  });
});
