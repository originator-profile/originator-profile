import { describe, expect, test } from "vitest";
import { BasicTarget } from "./basic-target";
import { ExternalResourceTarget } from "./external-resource-target";
import { RawTarget } from "./raw-target";
import { Target } from "./target";

const VALID_INTEGRITY = `sha256-${"A".repeat(43)}=`;

describe("target[].integrity バリデーション", () => {
  describe("有効な値", () => {
    test("sha256 形式の integrity を受け付ける", () => {
      expect(
        BasicTarget.safeParse({
          type: "TextTargetIntegrity",
          integrity: VALID_INTEGRITY,
          cssSelector: "#main",
        }).success,
      ).toBe(true);
    });
  });

  describe("不正な integrity", () => {
    test("sha256- で始まらない → エラーメッセージに対応アルゴリズムの記述がある", () => {
      const result = BasicTarget.safeParse({
        type: "TextTargetIntegrity",
        integrity: "md5-abcdef1234567890",
        cssSelector: "#main",
      });
      expect(result.success).toBe(false);
      const msg = result.error?.issues[0].message;
      expect(msg).toMatch(/sha256|sha384|sha512/);
    });

    test("プレフィックスのない文字列 → エラー", () => {
      const result = BasicTarget.safeParse({
        type: "TextTargetIntegrity",
        integrity: "A".repeat(44),
        cssSelector: "#main",
      });
      expect(result.success).toBe(false);
    });

    test("sha256 で padding が == → エラー", () => {
      const result = BasicTarget.safeParse({
        type: "TextTargetIntegrity",
        integrity: `sha256-${"A".repeat(43)}==`,
        cssSelector: "#main",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("target[].cssSelector バリデーション", () => {
  describe("有効な値", () => {
    const valid = [
      "#main",
      ".article",
      "body > p",
      "[data-id='test']",
      "div.container",
      "article > .body p",
    ];
    for (const selector of valid) {
      test(`"${selector}" を受け付ける`, () => {
        expect(
          RawTarget.safeParse({
            type: "TextTargetIntegrity",
            cssSelector: selector,
          }).success,
        ).toBe(true);
      });
    }
  });

  describe("ExternalResourceTarget", () => {
    test("cssSelector を省略できる", () => {
      expect(
        ExternalResourceTarget.safeParse({
          type: "ExternalResourceTargetIntegrity",
          integrity: VALID_INTEGRITY,
        }).success,
      ).toBe(true);
    });

    test("cssSelector を保持する", () => {
      const result = ExternalResourceTarget.safeParse({
        type: "ExternalResourceTargetIntegrity",
        integrity: VALID_INTEGRITY,
        cssSelector: "#hero-image",
      });
      expect(result.data?.cssSelector).toBe("#hero-image");
    });

    test("文字列以外の cssSelector → エラー", () => {
      expect(
        ExternalResourceTarget.safeParse({
          type: "ExternalResourceTargetIntegrity",
          integrity: VALID_INTEGRITY,
          cssSelector: 123,
        }).success,
      ).toBe(false);
    });

    test("Target が cssSelector 付きの External Resource Target を受け付ける", () => {
      const result = Target.safeParse({
        type: "ExternalResourceTargetIntegrity",
        integrity: VALID_INTEGRITY,
        cssSelector: "#hero-image",
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ cssSelector: "#hero-image" });
    });
  });
});
