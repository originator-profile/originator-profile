import { describe, expect, test } from "vitest";
import { verifyAllowedOrigin } from "./verify-allowed-origin";

describe("verify-allowed-origin", () => {
  test("allowedOriginの配列に対する検証でtrueが返されるか", () => {
    expect(
      verifyAllowedOrigin("https://ad.example.com", [
        "https://ad.example.com",
        "https://ad.example1.com",
      ]),
    ).toBeTruthy();
  });

  test("allowedOriginの配列に対する検証でfalseが返されるか", () => {
    expect(
      verifyAllowedOrigin("https://example.com", [
        "https://ad.example1.com",
        "https://ad.example2.com",
      ]),
    ).toBeFalsy();
  });

  test("allowedOriginが単一の文字列の検証でfalseが返されるか", () => {
    expect(
      verifyAllowedOrigin("https://example.com", "https://ad.example1.com"),
    ).toBeFalsy();
  });

  test("空文字で検証をした時にfalseが返されるか", () => {
    expect(verifyAllowedOrigin("", "https://example.com")).toBeFalsy();
  });

  test("一部一致するURLでfalseが返されるか", () => {
    expect(
      verifyAllowedOrigin("https://example.co", "https://example.com"),
    ).toBeFalsy();
  });

  test('"null"オリジンを与えた時にfalseが返されるか', () => {
    expect(verifyAllowedOrigin("null", "https://example.com")).toBeFalsy();
    expect(verifyAllowedOrigin("https://example.com", "null")).toBeFalsy();
    expect(verifyAllowedOrigin("https://example.com", ["null"])).toBeFalsy();
    expect(verifyAllowedOrigin("null", "null")).toBeFalsy();
  });
});
