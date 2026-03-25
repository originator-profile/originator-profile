import { describe, expect, test } from "vitest";
import { Certificate } from "../src/certificate/certificate";

const baseCertificate = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    { "@language": "ja" },
  ],
  type: ["VerifiableCredential", "Certificate"],
  issuer: "dns:example.com",
  credentialSubject: {
    id: "dns:example.com",
    type: "CertificateProperties",
    certificationSystem: {
      id: "https://example.com/cert-system",
      type: "CertificationSystem",
      name: "Test Certification System",
    },
  },
} as const;

describe("datetime validation accepts xsd:dateTimeStamp formats", () => {
  test("UTC (Z suffix)", () => {
    const result = Certificate.safeParse({
      ...baseCertificate,
      validFrom: "2024-01-01T00:00:00Z",
      validUntil: "2025-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  test("positive timezone offset (+09:00)", () => {
    const result = Certificate.safeParse({
      ...baseCertificate,
      validFrom: "2024-01-01T09:00:00+09:00",
      validUntil: "2025-01-01T09:00:00+09:00",
    });
    expect(result.success).toBe(true);
  });

  test("negative timezone offset (-05:00)", () => {
    const result = Certificate.safeParse({
      ...baseCertificate,
      validFrom: "2024-01-01T00:00:00-05:00",
    });
    expect(result.success).toBe(true);
  });

  test("UTC with milliseconds", () => {
    const result = Certificate.safeParse({
      ...baseCertificate,
      validFrom: "2024-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("datetime validation rejects non-xsd:dateTimeStamp formats", () => {
  test("missing timezone", () => {
    const result = Certificate.safeParse({
      ...baseCertificate,
      validFrom: "2024-01-01T00:00:00",
    });
    expect(result.success).toBe(false);
  });

  test("date only", () => {
    const result = Certificate.safeParse({
      ...baseCertificate,
      validFrom: "2024-01-01",
    });
    expect(result.success).toBe(false);
  });

  test("error message references xsd:dateTimeStamp", () => {
    const result = Certificate.safeParse({
      ...baseCertificate,
      validFrom: "not-a-date",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0].message;
      expect(message).toContain("xsd:dateTimeStamp");
    }
  });
});
