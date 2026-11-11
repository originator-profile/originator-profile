import { describe, expect, test } from "vitest";
import { detailOf } from "./annotations";
import { organizationOf } from "./organization";
import { existencePa, membershipPa, originator } from "./test-fixtures";

const id = "dns:publisher.example";

const accreditation = {
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  type: ["VerifiableCredential", "ProfileAnnotation"],
  issuer: "dns:registry.example",
  credentialSubject: {
    id,
    type: "IssuerAccreditation",
    annotation: { id: "urn:uuid:accreditation", name: "認定証" },
  },
};

const detail = (annotations: unknown[]) => {
  const originators = [
    originator(id, { name: "publisher", annotations }),
    originator("dns:pa-issuer.example", { name: "pa-issuer" }),
  ];
  const organization = organizationOf(id, originators);
  if (!organization) throw new Error("organization not found");
  return detailOf(organization, originators);
};

describe("detailOf", () => {
  test("PA を発行者ごとにまとめ、OP に含まれる順序を保つ", () => {
    const { groups } = detail([
      membershipPa(id, "urn:uuid:first"),
      existencePa(id, "JP"),
      membershipPa(id, "urn:uuid:second"),
    ]);
    expect(
      groups.map(({ issuer, annotations }) => [
        issuer.id,
        annotations.map(({ type }) => type),
      ]),
    ).toEqual([
      ["dns:association.example", ["Membership", "Membership"]],
      ["dns:pa-issuer.example", ["JP-OrganizationExistenceCertificate"]],
    ]);
  });

  test("PA 発行者の名前をその組織の WMP から得る", () => {
    const { groups } = detail([existencePa(id, "JP")]);
    expect(groups[0]?.issuer).toMatchObject({ name: "pa-issuer" });
  });

  test("認定証 PA は含めない", () => {
    expect(detail([accreditation]).groups).toEqual([]);
  });
});
