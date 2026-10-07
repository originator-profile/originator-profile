import { describe, expect, test } from "vitest";
import { AllowedUrl } from "./allowed-url";

describe("AllowedUrl バリデーション", () => {
  describe("有効な値", () => {
    test("URL Pattern 文字列を受け付ける", () => {
      expect(AllowedUrl.safeParse("https://example.com/*").success).toBe(true);
    });

    test("パス付き URL Pattern を受け付ける", () => {
      expect(
        AllowedUrl.safeParse("https://media.example.com/articles/*").success,
      ).toBe(true);
    });

    test("サブドメインワイルドカードを受け付ける", () => {
      expect(
        AllowedUrl.safeParse("https://*.example.com/article/*").success,
      ).toBe(true);
    });

    test("URL Pattern の配列を受け付ける", () => {
      expect(
        AllowedUrl.safeParse([
          "https://a.example.com/*",
          "https://b.example.com/*",
        ]).success,
      ).toBe(true);
    });

    test("ワイルドカードなしの URL も受け付ける", () => {
      expect(
        AllowedUrl.safeParse("https://example.com/articles/42").success,
      ).toBe(true);
    });

    test.each([
      "http://localhost:8080/*",
      "https://example.com:*/*",
      "https://日本語.jp/*",
      "{https}://{example.com}/*",
    ])("%s を受け付ける", (value) => {
      expect(AllowedUrl.safeParse(value).success).toBe(true);
    });
  });

  describe("スキームが https でない (不正)", () => {
    test.each([
      "http://example.com/*",
      "*://example.com/*",
      "http{s}?://example.com/*",
      "file:///*",
    ])("%s → エラー", (value) => {
      expect(AllowedUrl.safeParse(value).success).toBe(false);
    });
  });

  describe("ホスト名が固定されていない (不正)", () => {
    test.each([
      "https://*",
      "https://*/*",
      "https:*",
      "https://ex*.com/*",
      "https://*.*.example.com/*",
      "https://example.com.*/*",
      "https://:host/*",
      "https://example.(com|net)/*",
      "https://foo{.example.com}?/*",
    ])("%s → エラー", (value) => {
      expect(AllowedUrl.safeParse(value).success).toBe(false);
    });
  });

  describe("* のみの指定 (不正)", () => {
    test('"*" → エラーメッセージに URL Pattern の案内がある', () => {
      const result = AllowedUrl.safeParse("*");
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toMatch(/URL Pattern/);
    });

    test('"*" → エラーコードが invalid_format', () => {
      const result = AllowedUrl.safeParse("*");
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].code).toBe("invalid_format");
    });

    test('"*" の配列 → エラー', () => {
      const result = AllowedUrl.safeParse(["*"]);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toMatch(/URL Pattern/);
    });
  });

  describe("ベース URL なし (不正)", () => {
    test('"/article/*" (スキームなし相対パス) → エラー', () => {
      expect(AllowedUrl.safeParse("/article/*").success).toBe(false);
    });

    test('"example.com/*" (https:// なし) → エラー', () => {
      expect(AllowedUrl.safeParse("example.com/*").success).toBe(false);
    });
  });

  describe("URL として不正な文字列", () => {
    test('"not-a-url" → エラー', () => {
      expect(AllowedUrl.safeParse("not-a-url").success).toBe(false);
    });

    test("空文字 → エラー", () => {
      expect(AllowedUrl.safeParse("").success).toBe(false);
    });
  });

  describe("空配列 (不正)", () => {
    test("[] → エラー", () => {
      expect(AllowedUrl.safeParse([]).success).toBe(false);
    });
  });
});
