import { CertificationSystem } from "@originator-profile/model";
import { describe, expect, test } from "vitest";
import { CertificationSystemValidationFailed } from "./errors";
import { validateCertificationSystem } from "./validate-certification-system";

const certificationSystem: CertificationSystem = {
  type: "CertificationSystem",
  name: "Certification System Name",
  id: "https://cert-system.example.org",
  description: "Certification System Description",
  ref: "https://cert-system.example.org/details",
};

test("有効な形式の認証制度のとき検証に成功", () => {
  const result = validateCertificationSystem(certificationSystem);
  expect(result).toMatchObject(certificationSystem);
});

describe("無効な形式の認証制度のとき検証に失敗", () => {
  test("オブジェクトでない", () => {
    const invalidCertificationSystem = "invalid";
    const result = validateCertificationSystem(invalidCertificationSystem);
    expect(result).instanceOf(CertificationSystemValidationFailed);
  });
  test("必要なプロパティがない", () => {
    const invalidCertificationSystem = {};
    const result = validateCertificationSystem(invalidCertificationSystem);
    expect(result).instanceOf(CertificationSystemValidationFailed);
  });
  test("余分なプロパティがある", () => {
    const invalidCertificationSystem = {
      ...certificationSystem,
      invalid: "invalid",
    };
    const result = validateCertificationSystem(invalidCertificationSystem);
    expect(result).instanceOf(CertificationSystemValidationFailed);
  });
  test("定数値が一致しない", () => {
    const invalidCertificationSystem = {
      ...certificationSystem,
      type: "invalid",
    };
    const result = validateCertificationSystem(invalidCertificationSystem);
    expect(result).instanceOf(CertificationSystemValidationFailed);
  });
  test("文字列値ではない", () => {
    const invalidCertificationSystem = {
      ...certificationSystem,
      name: 1,
    };
    const result = validateCertificationSystem(invalidCertificationSystem);
    expect(result).instanceOf(CertificationSystemValidationFailed);
  });
});
