import { expect, test } from "vitest";
import {
  decodePayload,
  expiresAt,
  isExpiring,
  ownEntry,
  parseCas,
  recordedOf,
  upsertOwnItem,
} from "./cas";

const jwt = (payload: Record<string, unknown>) => {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none" })}.${part(payload)}.sig`;
};

test("upsertOwnItem: replaces the CA for the issuer and keeps the others", () => {
  const other = jwt({ issuer: "dns:other", n: 1 });
  const own = jwt({ issuer: "dns:example.com", n: 2 });
  const next = jwt({ issuer: "dns:example.com", n: 3 });
  const wrapped = { main: true, attestation: own, note: "keep" };

  expect(upsertOwnItem([other, wrapped], next, "dns:example.com")).toEqual([
    other,
    { main: true, attestation: next, note: "keep" },
  ]);
  expect(upsertOwnItem([other], next, "dns:example.com")).toEqual([
    other,
    next,
  ]);
});

test("ownEntry: returns the decoded CA for the issuer", () => {
  const payload = { issuer: "dns:example.com", exp: 10 };
  const entry = ownEntry(
    [jwt({ issuer: "dns:other" }), jwt(payload)],
    "dns:example.com",
  );
  expect(entry?.payload).toEqual(payload);
});

test("decodePayload: returns undefined for a JWT that does not decode", () => {
  expect(decodePayload(undefined)).toBeUndefined();
  expect(decodePayload("not-a-jwt")).toBeUndefined();
});

test("expiresAt and isExpiring: a missing exp is expiring, a later exp is not", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const soon = jwt({
    exp: Math.floor(now.getTime() / 1000) + 10 * 24 * 60 * 60,
  });
  const later = jwt({
    exp: Math.floor(now.getTime() / 1000) + 40 * 24 * 60 * 60,
  });

  expect(expiresAt("not-a-jwt")).toBeUndefined();
  expect(isExpiring(undefined, 30, now)).toBe(true);
  expect(isExpiring(expiresAt(soon), 30, now)).toBe(true);
  expect(isExpiring(expiresAt(later), 30, now)).toBe(false);
});

test("recordedOf: reads the subject id and the text selector", () => {
  expect(
    recordedOf({
      credentialSubject: { id: "urn:uuid:1" },
      target: [
        { type: "ExternalResourceTargetIntegrity", integrity: "sha256-x" },
        { type: "TextTargetIntegrity", cssSelector: "article" },
      ],
    }),
  ).toEqual({ id: "urn:uuid:1", selector: "article" });
  expect(recordedOf({})).toEqual({});
});

test("parseCas: rejects an item that is not a CA", () => {
  expect(() => parseCas(JSON.stringify([1]))).toThrow(
    "Invalid CAS file format (expected JSON array with JWT string)",
  );
});
