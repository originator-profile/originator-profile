import { expect, test } from "vitest";
import { MembershipPA } from "./membership-pa";

const membershipPA = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
      "@language": "ja",
    },
  ],
  type: ["VerifiableCredential", "ProfileAnnotation"],
  issuer: "dns:pa-issuer.example.org",
  credentialSubject: {
    id: "dns:example.com",
    type: "Membership",
    name: "○○協会 会員",
    annotation: {
      id: "https://pa-issuer.example.org/policy",
      type: "ProfileAnnotationPolicy",
      name: "○○協会 会員規約",
    },
  },
  validFrom: "2024-03-01T00:00:00Z",
};

test("membership pa schema is valid", () => {
  expect(MembershipPA.safeParse(membershipPA).success).toBe(true);
});

test("membership pa schema rejects other credentialSubject.type", () => {
  const result = MembershipPA.safeParse({
    ...membershipPA,
    credentialSubject: {
      ...membershipPA.credentialSubject,
      type: "AdvertisingQualityCertificate",
    },
  });
  expect(result.success).toBe(false);
});
