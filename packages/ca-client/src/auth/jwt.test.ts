import { expect, test } from "vitest";
import { decodeJwtPayload, getJwtExpiration } from "./jwt";

const createJwtToken = (
  payload: Record<string, unknown>,
  signature = "signature",
): string => {
  const encodedHeader = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

test("decodeJwtPayload: decodes a valid JWT", () => {
  const payload = { sub: "123", exp: 1735689600 };
  expect(decodeJwtPayload(createJwtToken(payload))).toEqual(payload);
});

test("decodeJwtPayload: throws when the token does not have 3 parts", () => {
  expect(() => decodeJwtPayload("header.payload")).toThrow(
    "Invalid JWT: expected 3 parts, got 2",
  );
});

test("decodeJwtPayload: throws when the payload is empty", () => {
  expect(() => decodeJwtPayload("header..signature")).toThrow(
    "Invalid JWT: empty payload",
  );
});

test("getJwtExpiration: returns exp when it is a number, otherwise undefined", () => {
  expect(getJwtExpiration(createJwtToken({ exp: 1735689600 }))).toBe(
    1735689600,
  );
  expect(getJwtExpiration(createJwtToken({ sub: "x" }))).toBeUndefined();
  expect(getJwtExpiration("invalid.token")).toBeUndefined();
});
