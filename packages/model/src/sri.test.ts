import { describe, expect, test } from "vitest";
import { SubresourceIntegrity } from "./sri";

// 各アルゴリズムで構文上有効なダミー値
// sha256: 43 base64 文字 + "="
const VALID_SHA256 = `sha256-${"A".repeat(43)}=`;
// sha384: 64 base64 文字 (padding なし)
const VALID_SHA384 = `sha384-${"A".repeat(64)}`;
// sha512: 86 base64 文字 + "=="
const VALID_SHA512 = `sha512-${"A".repeat(86)}==`;

describe("SubresourceIntegrity validation", () => {
  describe("有効な値", () => {
    test("sha256 形式を受け付ける", () => {
      expect(SubresourceIntegrity.safeParse(VALID_SHA256).success).toBe(true);
    });

    test("sha384 形式を受け付ける", () => {
      expect(SubresourceIntegrity.safeParse(VALID_SHA384).success).toBe(true);
    });

    test("sha512 形式を受け付ける", () => {
      expect(SubresourceIntegrity.safeParse(VALID_SHA512).success).toBe(true);
    });
  });

  describe("サポート対象外アルゴリズム", () => {
    test("md5- → エラー", () => {
      expect(
        SubresourceIntegrity.safeParse(`md5-${"A".repeat(24)}`).success,
      ).toBe(false);
    });

    test("sha1- → エラー", () => {
      expect(
        SubresourceIntegrity.safeParse(`sha1-${"A".repeat(27)}=`).success,
      ).toBe(false);
    });

    test("sha3-256- → エラー", () => {
      expect(
        SubresourceIntegrity.safeParse(`sha3-256-${"A".repeat(43)}=`).success,
      ).toBe(false);
    });
  });

  describe("padding の誤り", () => {
    test("sha256 で == (二重 padding) → エラー", () => {
      expect(
        SubresourceIntegrity.safeParse(`sha256-${"A".repeat(43)}==`).success,
      ).toBe(false);
    });

    test("sha256 で padding なし → エラー", () => {
      expect(
        SubresourceIntegrity.safeParse(`sha256-${"A".repeat(43)}`).success,
      ).toBe(false);
    });

    test("sha512 で = (一重 padding) → エラー", () => {
      expect(
        SubresourceIntegrity.safeParse(`sha512-${"A".repeat(86)}=`).success,
      ).toBe(false);
    });

    test("sha512 で padding なし → エラー", () => {
      expect(
        SubresourceIntegrity.safeParse(`sha512-${"A".repeat(86)}`).success,
      ).toBe(false);
    });

    test("sha384 で = が付く → エラー (sha384 は padding 不要)", () => {
      expect(
        SubresourceIntegrity.safeParse(`sha384-${"A".repeat(64)}=`).success,
      ).toBe(false);
    });
  });

  describe("プレフィックスなし", () => {
    test("ただの base64 文字列 → エラー", () => {
      expect(SubresourceIntegrity.safeParse("A".repeat(44)).success).toBe(
        false,
      );
    });
  });
});
