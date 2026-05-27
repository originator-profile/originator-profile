import { generateKey } from "@originator-profile/cryptography";
import type { UnsignedWebsiteProfile } from "@originator-profile/model";
import { addYears, getUnixTime } from "date-fns";
import { decodeJwt, decodeProtectedHeader } from "jose";
import { expect, test } from "vitest";
import { createIntegrityMetadata } from "websri";
import { signWsp } from "./sign-wsp";

test("signWsp() return a valid JWT with correct claims and digestSRI", async () => {
  const image = {
    id: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
  };

  const digestSri = await createIntegrityMetadata(
    "sha256",
    await new Response(
      `<svg xmlns="http://www.w3.org/2000/svg"></svg>`,
    ).arrayBuffer(),
  );

  const issuedAt = new Date();
  const expiredAt = addYears(new Date(), 10);

  const uwsp: UnsignedWebsiteProfile = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      {
        "@language": "ja",
      },
    ],
    type: ["VerifiableCredential", "WebsiteProfile"],
    issuer: "dns:example.com",
    credentialSubject: {
      id: "https://example.com",
      type: "WebSite",
      name: "Example",
      image,
      allowedOrigin: ["https://example.com"],
    },
  };

  const { publicKey, privateKey } = await generateKey();
  const jwt = await signWsp(uwsp, privateKey, { issuedAt, expiredAt });
  const payload = decodeJwt(jwt);
  const header = decodeProtectedHeader(jwt);

  expect(header.kid).toBe(publicKey.kid);

  expect(
    (payload.credentialSubject as { image: { id: string; digestSRI: string } })
      .image,
  ).toEqual({
    id: image.id,
    digestSRI: digestSri.toString(),
  });

  expect(payload).toMatchObject({
    iss: uwsp.issuer,
    iat: getUnixTime(issuedAt),
    exp: getUnixTime(expiredAt),
    sub: uwsp.credentialSubject.id,
  });
});

test("signWsp() returns an array of JWTs when given an array of UWSPs", async () => {
  const image = {
    id: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
  };

  const digestSri = await createIntegrityMetadata(
    "sha256",
    await new Response(
      `<svg xmlns="http://www.w3.org/2000/svg"></svg>`,
    ).arrayBuffer(),
  );

  const issuedAt = new Date();
  const expiredAt = addYears(new Date(), 10);

  const baseUwsp: UnsignedWebsiteProfile = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      {
        "@language": "ja-JP",
      },
    ],
    type: ["VerifiableCredential", "WebsiteProfile"],
    issuer: "dns:example.com",
    credentialSubject: {
      id: "https://example.com",
      type: "WebSite",
      name: "Example",
      image,
      allowedOrigin: ["https://example.com"],
    },
  };

  const uwspJa = baseUwsp;
  const uwspEn: UnsignedWebsiteProfile = {
    ...baseUwsp,
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      {
        "@language": "en-US",
      },
    ],
    credentialSubject: {
      ...baseUwsp.credentialSubject,
      name: "Example (English)",
    },
  };

  const { publicKey, privateKey } = await generateKey();
  const jwts = await signWsp([uwspJa, uwspEn], privateKey, {
    issuedAt,
    expiredAt,
  });

  expect(Array.isArray(jwts)).toBe(true);
  expect(jwts).toHaveLength(2);

  const [payloadJa, payloadEn] = jwts.map((jwt) => decodeJwt(jwt));
  const [headerJa, headerEn] = jwts.map((jwt) => decodeProtectedHeader(jwt));

  expect(headerJa.kid).toBe(publicKey.kid);
  expect(headerEn.kid).toBe(publicKey.kid);

  expect(
    payloadJa.credentialSubject as {
      name: string;
      image: { digestSRI: string };
    },
  ).toMatchObject({
    name: "Example",
    image: { id: image.id, digestSRI: digestSri.toString() },
  });

  expect(
    payloadEn.credentialSubject as {
      name: string;
      image: { digestSRI: string };
    },
  ).toMatchObject({
    name: "Example (English)",
    image: { id: image.id, digestSRI: digestSri.toString() },
  });

  for (const payload of [payloadJa, payloadEn]) {
    expect(payload).toMatchObject({
      iss: baseUwsp.issuer,
      iat: getUnixTime(issuedAt),
      exp: getUnixTime(expiredAt),
      sub: baseUwsp.credentialSubject.id,
    });
  }
});

test("signWsp() throws Error when given an empty array", async () => {
  const expiredAt = addYears(new Date(), 10);
  const { privateKey } = await generateKey();
  await expect(signWsp([], privateKey, { expiredAt })).rejects.toThrow(
    /At least one UnsignedWebsiteProfile is required/,
  );
});
