import { generateKey } from "@originator-profile/cryptography";
import { CoreProfile } from "@originator-profile/model";
import {
  JwtVcDecoder,
  VcDecodeFailed,
} from "@originator-profile/securing-mechanism";
import { signCp } from "@originator-profile/sign";
import { addYears } from "date-fns";
import { expect, test } from "vitest";

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
      keys: [],
    },
  },
};

test("Core Profile のデコードに成功", async () => {
  const { privateKey } = await generateKey();
  const jwt = await signCp(coreProfile, privateKey, { issuedAt, expiredAt });
  const decoder = JwtVcDecoder();
  const decoded = decoder(jwt);
  expect(decoded).not.instanceOf(Error);
  // @ts-expect-error assert
  expect(decoded.doc).toStrictEqual(coreProfile);
});

test("無効な形式のJWTのときデコードに失敗", () => {
  const invalidJwt = "invalid.jwt";
  const decoder = JwtVcDecoder();
  const decoded = decoder(invalidJwt);
  expect(decoded).instanceOf(VcDecodeFailed);
});
