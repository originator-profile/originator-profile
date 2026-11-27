import { describe, expect, test } from "vitest";
import { organizationOf } from "./organization";
import { existencePa, membershipPa, originator } from "./test-fixtures";

const id = "dns:publisher.example";

describe("organizationOf", () => {
  test("一致する発信者がいなければ undefined", () => {
    expect(organizationOf(id, [originator("dns:other.example")])).toBe(
      undefined,
    );
  });

  test("同じ組織の発信者を合わせて WMP と PA を得る", () => {
    const organization = organizationOf(id, [
      originator(id),
      originator(id, {
        name: "publisher",
        annotations: [existencePa(id, "JP")],
      }),
    ]);
    expect(organization?.media?.credentialSubject.name).toBe("publisher");
    expect(organization?.country).toBe("JP");
    expect(organization?.corporateNumber).toBe("0000000000000");
  });

  test("業界団体所属証は先頭のものの名前を得る", () => {
    const organization = organizationOf(id, [
      originator(id, {
        annotations: [
          existencePa(id, "JP"),
          membershipPa(id, "urn:uuid:first"),
          membershipPa(id, "urn:uuid:second"),
        ],
      }),
    ]);
    expect(organization?.membership).toBe("urn:uuid:first");
  });

  test("PA は OP に含まれる順序を保つ", () => {
    const organization = organizationOf(id, [
      originator(id, {
        annotations: [
          membershipPa(id, "urn:uuid:second"),
          existencePa(id, "JP"),
          membershipPa(id, "urn:uuid:first"),
        ],
      }),
    ]);
    expect(
      organization?.annotations.map(
        ({ credentialSubject }) => credentialSubject.type,
      ),
    ).toEqual([
      "Membership",
      "JP-OrganizationExistenceCertificate",
      "Membership",
    ]);
  });

  test("組織実在証が無ければ国と法人番号を持たない", () => {
    const organization = organizationOf(id, [
      originator(id, { annotations: [membershipPa(id, "urn:uuid:policy")] }),
    ]);
    expect(organization).toMatchObject({
      country: undefined,
      corporateNumber: undefined,
    });
  });

  test("業界団体所属証が無ければ membership を持たない", () => {
    const organization = organizationOf(id, [
      originator(id, { annotations: [existencePa(id, "JP")] }),
    ]);
    expect(organization?.membership).toBe(undefined);
  });
});
