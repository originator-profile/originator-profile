import { expect, test } from "vitest";
import { CaClientError, CaClientErrorCode } from "../errors";
import { parseDates } from "./dates";

test("parseDates: returns issuedAt and expiredAt when expiredAt is after issuedAt", () => {
  const issuedAt = new Date("2024-01-01T00:00:00.000Z");
  const expiredAt = new Date("2025-01-01T00:00:00.000Z");

  expect(parseDates({ issuedAt, expiredAt })).toEqual({ issuedAt, expiredAt });
});

test("parseDates: defaults expiredAt to one year after issuedAt", () => {
  const issuedAt = new Date("2024-01-01T00:00:00.000Z");

  expect(parseDates({ issuedAt })).toEqual({
    issuedAt,
    expiredAt: new Date("2025-01-01T00:00:00.000Z"),
  });
});

test("parseDates: throws when issuedAt is invalid", () => {
  expect(() => parseDates({ issuedAt: "not-a-date" })).toThrow(
    new CaClientError("issuedAt must be a valid date", {
      code: CaClientErrorCode.Validation,
    }),
  );
});

test("parseDates: throws when expiredAt is invalid", () => {
  expect(() =>
    parseDates({
      issuedAt: new Date("2024-01-01T00:00:00.000Z"),
      expiredAt: "not-a-date",
    }),
  ).toThrow(
    new CaClientError("expiredAt must be a valid date", {
      code: CaClientErrorCode.Validation,
    }),
  );
});

test("parseDates: throws when expiredAt is before issuedAt", () => {
  const issuedAt = new Date("2025-01-01T00:00:00.000Z");
  const expiredAt = new Date("2024-01-01T00:00:00.000Z");

  expect(() => parseDates({ issuedAt, expiredAt })).toThrow(
    new CaClientError("expiredAt must be after issuedAt", {
      code: CaClientErrorCode.Validation,
    }),
  );
});

test("parseDates: throws when expiredAt equals issuedAt", () => {
  const issuedAt = new Date("2024-01-01T00:00:00.000Z");

  expect(() => parseDates({ issuedAt, expiredAt: issuedAt })).toThrow(
    new CaClientError("expiredAt must be after issuedAt", {
      code: CaClientErrorCode.Validation,
    }),
  );
});
