import { describe, test, expect } from "vitest";
import sortCertificates from "./sort-certificates";
import { VerifiedVc } from "@originator-profile/securing-mechanism";
import { Certificate } from "@originator-profile/verify";

const makeCertificate = (id: string): VerifiedVc<Certificate> => ({
  doc: {
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
  },
  source: "test",
  validated: false,
  verificationKey: {
    crv: "P-256",
    kid: "jJYs5_ILgUc8180L-pBPxBpgA3QC7eZu9wKOkh9mYPU",
    kty: "EC",
    x: "ypAlUjo5O5soUNHk3mlRyfw6ujxqjfD_HMQt7XH-rSg",
    y: "1cmv9lmZvL0XAERNxvrT2kZkC4Uwu5i1Or1O-4ixJuE",
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
    expect(
      result.map((c) => c.doc.credentialSubject.certificationSystem.id),
    ).toEqual([
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
    expect(
      result.map((c) => c.doc.credentialSubject.certificationSystem.id),
    ).toEqual([
      "urn:uuid:8029ece0-b327-4a7e-b586-3e442cb82d92",
      "urn:uuid:85c92abe-4518-42bb-855d-dffeabfe4a38",
      "unknown",
    ]);
  });

  test("空配列を処理できる", () => {
    const result = sortCertificates([]);
    expect(result).toEqual([]);
  });
});
