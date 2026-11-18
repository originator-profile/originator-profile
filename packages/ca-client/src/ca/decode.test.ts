import { expect, test } from "vitest";
import { decodeCa } from "./decode.ts";

const encodeJwt = (
  payload: unknown,
  header: Record<string, unknown> = { alg: "ES256", typ: "vc+jwt" },
) =>
  `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

test("decodeCa: returns jwt and payload with JWT registered claims stripped", () => {
  const payload = {
    target: [{ type: "TextTargetIntegrity" }],
    iss: "dns:x",
    credentialSubject: { id: "urn:uuid:1" },
  };
  const jwt = encodeJwt(payload);

  expect(decodeCa(jwt)).toEqual({
    jwt,
    payload: {
      target: payload.target,
      credentialSubject: payload.credentialSubject,
    },
  });
});

test("decodeCa: includes expiresAt when the JWT has exp", () => {
  const jwt = encodeJwt({
    credentialSubject: { id: "urn:uuid:1" },
    exp: 1_700_000_000,
  });

  expect(decodeCa(jwt)).toEqual({
    jwt,
    payload: { credentialSubject: { id: "urn:uuid:1" } },
    expiresAt: new Date(1_700_000_000 * 1000),
  });
});

test("decodeCa: rejects an invalid JWT as CA_VALIDATION", () => {
  expect(() => decodeCa("not-a-jwt")).toThrow(
    "Failed to decode CAS JWT: JWT VC Decoding Failure",
  );
});
