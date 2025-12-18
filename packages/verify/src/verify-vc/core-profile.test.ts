import { generateKey, LocalKeys } from "@originator-profile/cryptography";
import { CoreProfile } from "@originator-profile/model";
import {
  JwtVcVerifier,
  VcValidator,
  VerifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import { signCp } from "@originator-profile/sign";
import { addYears } from "date-fns";
import { expect, test } from "vitest";

const VERIFIER_ID = "dns:example.org";
const issuedAt = new Date();
const expiredAt = addYears(new Date(), 10);
const coreProfile: CoreProfile = {
  type: ["VerifiableCredential", "CoreProfile"],
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
  ],
  issuer: "dns:example.org",
  credentialSubject: {
    id: "dns:example.com",
    type: "Core",
    jwks: {
      keys: [
        {
          kty: "EC",
          x: "QiVI-I-3gv-17KN0RFLHKh5Vj71vc75eSOkyMsxFxbE",
          y: "bEzRDEy41bihcTnpSILImSVymTQl9BQZq36QpCpJQnI",
          crv: "P-256",
          kid: "LIstkoCvByn4jk8oZPvigQkzTzO9UwnGnE-VMlkZvYQ",
        },
      ],
    },
  },
};

test("CoreProfile の検証に成功", async () => {
  const { publicKey, privateKey } = await generateKey();
  const keys = LocalKeys({ keys: [publicKey] });
  const validator = VcValidator<VerifiedJwtVc<CoreProfile>>(CoreProfile);
  const verifier = JwtVcVerifier(keys, VERIFIER_ID, validator);
  const jwt = await signCp(coreProfile, privateKey, { issuedAt, expiredAt });
  const result = await verifier(jwt);
  expect(result).not.toBeInstanceOf(Error);
  // @ts-expect-error assert
  expect(result.doc).toStrictEqual(coreProfile);
});
