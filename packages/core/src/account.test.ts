import crypto from "node:crypto";
import { describe, expect, test } from "vitest";
import { parseAccountId } from "./account";

describe("parseAccountId", () => {
  test("UUIDを指定したとき、そのまま返す", () => {
    const uuid = crypto.randomUUID();
    expect(parseAccountId(uuid)).toBe(uuid);
  });

  test("UUID URNを指定したとき、UUID文字列形式に変換", () => {
    const uuid = crypto.randomUUID();
    expect(parseAccountId(`urn:uuid:${uuid}`)).toBe(uuid);
  });

  test("FQDNを指定したとき、UUID文字列形式に変換", () => {
    expect(parseAccountId("example.com")).toBe(
      "cfbff0d1-9375-5685-968c-48ce8b15ae17",
    );
  });

  test("DNS URNを指定したとき、UUID文字列形式に変換", () => {
    expect(parseAccountId("dns:example.com")).toBe(
      "cfbff0d1-9375-5685-968c-48ce8b15ae17",
    );
  });
});
