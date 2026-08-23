import { expect, test } from "vitest";
import { CaClientError, CaClientErrorCode } from "./errors";
import { isEnoent, toFileError } from "./file-utils";

test("isEnoent: is true only for objects with code ENOENT", () => {
  expect(isEnoent({ code: "ENOENT" })).toBe(true);
  expect(isEnoent(Object.assign(new Error("missing"), { code: "ENOENT" }))).toBe(
    true,
  );

  expect(isEnoent({ code: "EACCES" })).toBe(false);
  expect(isEnoent(new Error("missing"))).toBe(false);
  expect(isEnoent(null)).toBe(false);
  expect(isEnoent("ENOENT")).toBe(false);
});

test("toFileError: returns the same CaClientError", () => {
  const error = new CaClientError("already wrapped", {
    code: CaClientErrorCode.Validation,
  });

  expect(toFileError("Failed to read", error)).toBe(error);
});

test("toFileError: wraps a non-CaClientError as a File error", () => {
  const cause = new Error("disk full");
  const wrapped = toFileError("Failed to write CAS file", cause);

  expect(wrapped).toBeInstanceOf(CaClientError);
  expect(wrapped.code).toBe(CaClientErrorCode.File);
  expect(wrapped.message).toBe("Failed to write CAS file: disk full");
  expect(wrapped.cause).toBe(cause);
});
