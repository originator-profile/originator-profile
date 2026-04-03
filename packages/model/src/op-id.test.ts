import { describe, expect, test } from "vitest";
import { OpId } from "./op-id";

describe("OpId バリデーション", () => {
  describe("有効な値", () => {
    const valid = [
      "dns:example.com",
      "dns:example.co.jp",
      "dns:my-site.example.org",
      "dns:sub.domain.example.com",
      "dns:xn--wgv71a309e.jp",
      "dns:localhost",
    ];
    for (const value of valid) {
      test(`"${value}" を受け付ける`, () => {
        expect(OpId.safeParse(value).success).toBe(true);
      });
    }
  });

  describe("dns: プレフィックスがない", () => {
    test("example.com → エラー", () => {
      expect(OpId.safeParse("example.com").success).toBe(false);
    });

    test("example.org → エラー", () => {
      expect(OpId.safeParse("example.org").success).toBe(false);
    });
  });

  describe("DNS 名として不正な文字", () => {
    test("アンダースコアを含むラベル → エラー", () => {
      expect(OpId.safeParse("dns:example_site.com").success).toBe(false);
    });

    test("_dmarc で始まるラベル → エラー", () => {
      expect(OpId.safeParse("dns:_dmarc.example.com").success).toBe(false);
    });

    test("ハイフン始まりのラベル → エラー", () => {
      expect(OpId.safeParse("dns:-example.com").success).toBe(false);
    });

    test("ハイフン終わりのラベル → エラー", () => {
      expect(OpId.safeParse("dns:example-.com").success).toBe(false);
    });

    test("dns: の後が空 → エラー", () => {
      expect(OpId.safeParse("dns:").success).toBe(false);
    });

    test("空ラベル (先頭ドット) → エラー", () => {
      expect(OpId.safeParse("dns:.example.com").success).toBe(false);
    });

    test("数字のみの TLD → エラー", () => {
      expect(OpId.safeParse("dns:test.123").success).toBe(false);
    });

    test("数字のみの単一ラベル → エラー", () => {
      expect(OpId.safeParse("dns:123").success).toBe(false);
    });
  });
});
