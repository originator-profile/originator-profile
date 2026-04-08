import { expect, test } from "vitest";
import { OpVc } from "./op-vc";

test("op vc schema is valid", () => {
  const sampleOpVc = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
    ],
    type: ["VerifiableCredential"],
    issuer: "dns:example.com",
    credentialSubject: {
      id: "dns:example.com",
    },
  };
  const result = OpVc.safeParse(sampleOpVc);
  expect(result.success).toBe(true);
});
