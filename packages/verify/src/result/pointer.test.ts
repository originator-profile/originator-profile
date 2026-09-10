import { describe, expect, test } from "vitest";
import { pointer } from "./pointer";

describe("pointer", () => {
  test("文字列は property、数値は index として連結する", () => {
    expect(pointer("originators", 0, "annotations", 1)).toBe(
      "$.originators[0].annotations[1]",
    );
  });

  test("単一のプロパティ", () => {
    expect(pointer("sites")).toBe("$.sites");
  });

  test("引数がなければルートを指す", () => {
    expect(pointer()).toBe("$");
  });
});
