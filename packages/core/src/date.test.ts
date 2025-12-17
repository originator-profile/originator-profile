import { describe, expect, test, vi } from "vitest";
import {
  expirationDateTimeLocaleFrom,
  isExpired,
  parseExpirationDate,
  parseIssuanceDate,
} from "./date";

test("ISO 8601 形式の日付", () => {
  expect(parseExpirationDate("2023-07-31").toISOString()).toBe(
    "2023-07-31T15:00:00.000Z",
  );
});

test("ISO 8601 形式の日付・時刻1", () => {
  expect(parseExpirationDate("2023-07-31T24:00:00.000Z").toISOString()).toBe(
    "2023-08-01T00:00:00.000Z",
  );
});

test("ISO 8601 形式の日付・時刻2", () => {
  expect(
    parseExpirationDate("2023-07-31T24:00:00.000+09:00").toISOString(),
  ).toBe("2023-07-31T15:00:00.000Z");
});

test("ロケールの表記規則に従って有効期限日付時刻文字列表現に変換1", () => {
  expect(
    expirationDateTimeLocaleFrom(
      new Date("2023-07-31T24:00:00.000+09:00"),
      "ja-JP",
    ),
  ).toBe("2023/7/31 23:59:59");
});

test("ロケールの表記規則に従って有効期限日付時刻文字列表現に変換2", () => {
  expect(
    expirationDateTimeLocaleFrom("2023-07-31T24:00:00.000+09:00", "ja-JP"),
  ).toBe("2023/7/31 23:59:59");
});

describe("isExpired(dateObject)", () => {
  const mockDate = new Date("2050-01-01T00:00:00.000+09:00");
  test("現在時刻と期限切れ時刻が等しい", () => {
    vi.setSystemTime(mockDate);
    expect(isExpired(new Date("2050-01-01T00:00:00.000+09:00"))).toBeTruthy();
    vi.useRealTimers();
  });
  test("期限切れ時刻が過去", () => {
    vi.setSystemTime(mockDate);
    expect(isExpired(new Date("2049-12-31T23:59:59.999+09:00"))).toBeTruthy();
    vi.useRealTimers();
  });
  test("期限切れ時刻が未来", () => {
    vi.setSystemTime(mockDate);
    expect(isExpired(new Date("2050-01-01T00:00:00.001+09:00"))).toBeFalsy();
    vi.useRealTimers();
  });
});

describe("isExpired(string)", () => {
  const mockDate = new Date("2050-01-01T00:00:00.000+09:00");
  test("現在時刻と期限切れ時刻が等しい", () => {
    vi.setSystemTime(mockDate);
    expect(isExpired("2050-01-01T00:00:00.000+09:00")).toBeTruthy();
    vi.useRealTimers();
  });

  test("期限切れ時刻が過去", () => {
    vi.setSystemTime(mockDate);
    expect(isExpired("2049-12-31")).toBeTruthy();
    vi.useRealTimers();
  });

  test("期限切れ時刻が未来", () => {
    vi.setSystemTime(mockDate);
    expect(isExpired("2050-01-01")).toBeFalsy();
    vi.useRealTimers();
  });
});

describe("発行日時", () => {
  test("ISO 8601 形式の日付", () => {
    expect(parseIssuanceDate("2023-07-31").toISOString()).toBe(
      "2023-07-30T15:00:00.000Z",
    );
  });

  test("ISO 8601 形式の日付・時刻1", () => {
    expect(parseIssuanceDate("2023-07-31T24:00:00.000Z").toISOString()).toBe(
      "2023-08-01T00:00:00.000Z",
    );
  });

  test("ISO 8601 形式の日付・時刻2", () => {
    expect(
      parseIssuanceDate("2023-07-31T24:00:00.000+09:00").toISOString(),
    ).toBe("2023-07-31T15:00:00.000Z");
  });
});
