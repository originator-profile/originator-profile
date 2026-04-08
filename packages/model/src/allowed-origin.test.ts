import { describe, expect, test } from "vitest";
import { AllowedOrigin } from "./allowed-origin";

describe("AllowedOrigin バリデーション", () => {
  describe("有効な値", () => {
    test('"https://example.com" を受け付ける', () => {
      expect(AllowedOrigin.safeParse("https://example.com").success).toBe(true);
    });

    test('"http://example.com:8080" (非デフォルトポート) を受け付ける', () => {
      expect(AllowedOrigin.safeParse("http://example.com:8080").success).toBe(
        true,
      );
    });

    test("配列形式を受け付ける", () => {
      expect(AllowedOrigin.safeParse(["https://example.com"]).success).toBe(
        true,
      );
    });
  });

  describe("末尾スラッシュ・パスを含む (不正)", () => {
    test('"https://example.com/" → エラーメッセージに scheme://host の記述がある', () => {
      const result = AllowedOrigin.safeParse("https://example.com/");
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toMatch(/scheme:\/\/host/);
    });

    test('"https://example.com/" → エラーコードが invalid_format', () => {
      const result = AllowedOrigin.safeParse("https://example.com/");
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].code).toBe("invalid_format");
    });

    test('"https://example.com/path" → エラー', () => {
      const result = AllowedOrigin.safeParse("https://example.com/path");
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toMatch(/scheme:\/\/host/);
    });

    test("配列内に末尾スラッシュあり → エラー", () => {
      const result = AllowedOrigin.safeParse(["https://example.com/"]);
      expect(result.success).toBe(false);
    });
  });

  describe("URL として不正", () => {
    test('"not-a-url" → エラー', () => {
      expect(AllowedOrigin.safeParse("not-a-url").success).toBe(false);
    });
  });
});
