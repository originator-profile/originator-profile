import { describe, expect, test } from "vitest";
import { DateTimeStamp } from "./date-time-stamp";

describe("datetime validation accepts xsd:dateTimeStamp formats", () => {
  test("UTC (Z suffix)", () => {
    expect(DateTimeStamp.safeParse("2024-01-01T00:00:00Z").success).toBe(true);
  });

  test("positive timezone offset (+09:00)", () => {
    expect(DateTimeStamp.safeParse("2024-01-01T09:00:00+09:00").success).toBe(
      true,
    );
  });

  test("negative timezone offset (-05:00)", () => {
    expect(DateTimeStamp.safeParse("2024-01-01T00:00:00-05:00").success).toBe(
      true,
    );
  });

  test("UTC with milliseconds", () => {
    expect(DateTimeStamp.safeParse("2024-01-01T00:00:00.000Z").success).toBe(
      true,
    );
  });
});

describe("datetime validation rejects non-xsd:dateTimeStamp formats", () => {
  test("missing timezone", () => {
    expect(DateTimeStamp.safeParse("2024-01-01T00:00:00").success).toBe(false);
  });

  test("date only", () => {
    expect(DateTimeStamp.safeParse("2024-01-01").success).toBe(false);
  });

  test("error message references xsd:dateTimeStamp", () => {
    expect(() => DateTimeStamp.parse("not-a-date")).toThrow(
      "xsd:dateTimeStamp",
    );
  });
});
