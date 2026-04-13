import { generateKey } from "@originator-profile/cryptography";
import type { Jwk } from "@originator-profile/model";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import {
  fileToDataUrl,
  isLocalPath,
  parseExpiresIn,
  parseKey,
  resolveKey,
  resolveLocalContent,
} from "./resolve-content";

describe("isLocalPath", () => {
  test("相対パスは true", () => {
    expect(isLocalPath("./images/logo.png")).toBe(true);
    expect(isLocalPath("../assets/photo.jpg")).toBe(true);
    expect(isLocalPath("images/logo.png")).toBe(true);
  });

  test("data URL は false", () => {
    expect(isLocalPath("data:image/png;base64,abc")).toBe(false);
  });

  test("HTTP URL は false", () => {
    expect(isLocalPath("https://example.com/img.png")).toBe(false);
    expect(isLocalPath("http://example.com/img.png")).toBe(false);
  });
});

describe("fileToDataUrl", () => {
  test("SVG ファイルを正しい MIME の Data URL に変換", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "resolve-test-"));
    const filePath = join(tempDir, "icon.svg");
    writeFileSync(filePath, "<svg></svg>");

    const result = fileToDataUrl(filePath);

    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  test("PNG ファイルを正しい MIME で変換", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "resolve-test-"));
    const filePath = join(tempDir, "photo.png");
    writeFileSync(filePath, "fake-png");

    const result = fileToDataUrl(filePath);

    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  test("動画ファイルを正しい MIME で変換", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "resolve-test-"));
    const filePath = join(tempDir, "clip.mp4");
    writeFileSync(filePath, "fake-mp4");

    expect(fileToDataUrl(filePath)).toMatch(/^data:video\/mp4;base64,/);
  });

  test("未知の拡張子は application/octet-stream", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "resolve-test-"));
    const filePath = join(tempDir, "data.bin");
    writeFileSync(filePath, "binary");

    expect(fileToDataUrl(filePath)).toMatch(
      /^data:application\/octet-stream;base64,/,
    );
  });
});

describe("resolveLocalContent", () => {
  test("文字列 content のローカルパスを Data URL に変換", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "resolve-test-"));
    writeFileSync(join(tempDir, "img.svg"), "<svg></svg>");

    const obj = { content: "./img.svg" };
    resolveLocalContent(obj, tempDir);

    expect(obj.content).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  test("配列 content 内のローカルパスをすべて変換", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "resolve-test-"));
    writeFileSync(join(tempDir, "a.png"), "a");
    writeFileSync(join(tempDir, "b.png"), "b");

    const obj = { content: ["./a.png", "./b.png"] };
    resolveLocalContent(obj, tempDir);

    expect(obj.content[0]).toMatch(/^data:image\/png;base64,/);
    expect(obj.content[1]).toMatch(/^data:image\/png;base64,/);
  });

  test("data URL はそのまま維持", () => {
    const dataUrl = "data:image/png;base64,abc";
    const obj = { content: dataUrl };
    resolveLocalContent(obj, "/tmp");

    expect(obj.content).toBe(dataUrl);
  });

  test("配列内の data URL とローカルパスが混在", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "resolve-test-"));
    writeFileSync(join(tempDir, "local.png"), "local");
    const dataUrl = "data:image/png;base64,remote";

    const obj = { content: [dataUrl, "./local.png"] };
    resolveLocalContent(obj, tempDir);

    expect(obj.content[0]).toBe(dataUrl);
    expect(obj.content[1]).toMatch(/^data:image\/png;base64,/);
  });

  test("undefined は何もしない", () => {
    expect(() => resolveLocalContent(undefined, "/tmp")).not.toThrow();
  });

  test("content が無いオブジェクトは何もしない", () => {
    const obj = { id: "https://example.com/img.png" };
    resolveLocalContent(obj as { content?: string }, "/tmp");

    expect(obj).toEqual({ id: "https://example.com/img.png" });
  });
});

describe("parseExpiresIn", () => {
  const base = new Date("2025-01-01T00:00:00Z");

  test("1y は1年後", () => {
    const result = parseExpiresIn("1y", base);
    expect(result.getFullYear()).toBe(2026);
  });

  test("6m は6ヶ月後", () => {
    const result = parseExpiresIn("6m", base);
    expect(result.getMonth()).toBe(6); // July (0-indexed)
  });

  test("30d は30日後", () => {
    const result = parseExpiresIn("30d", base);
    expect(result.getDate()).toBe(31);
  });

  test("不正フォーマットはエラー", () => {
    expect(() => parseExpiresIn("invalid", base)).toThrow(
      "Invalid expiresIn format",
    );
    expect(() => parseExpiresIn("1x", base)).toThrow(
      "Invalid expiresIn format",
    );
    expect(() => parseExpiresIn("", base)).toThrow("Invalid expiresIn format");
  });
});

describe("parseKey", () => {
  let privateKey: Jwk;

  beforeAll(async () => {
    const keys = await generateKey();
    privateKey = keys.privateKey;
  });

  test("Jwk オブジェクトはそのまま返す", () => {
    expect(parseKey(privateKey)).toBe(privateKey);
  });

  test("JSON 文字列をパースして返す", () => {
    const json = JSON.stringify(privateKey);
    const result = parseKey(json);
    expect(result).toEqual(privateKey);
  });

  test("不正な JSON 文字列は issuer を含むエラーメッセージ", () => {
    expect(() => parseKey("not-json", "dns:example.com")).toThrow(
      'Invalid signing key for issuer "dns:example.com"',
    );
  });

  test("不正な JSON 文字列は issuer なしでもエラー", () => {
    expect(() => parseKey("not-json")).toThrow("Invalid signing key");
  });

  test("kty が欠落した JSON はバリデーションエラー", () => {
    expect(() => parseKey('{"kid":"test"}', "dns:example.com")).toThrow(
      'Invalid signing key for issuer "dns:example.com"',
    );
  });
});

describe("resolveKey", () => {
  let privateKey: Jwk;

  beforeAll(async () => {
    const keys = await generateKey();
    privateKey = keys.privateKey;
  });

  test("issuer に対応する鍵を返す", () => {
    const issuers = { "dns:example.com": privateKey };
    expect(resolveKey(issuers, "dns:example.com")).toBe(privateKey);
  });

  test("未登録の issuer はエラー", () => {
    expect(() => resolveKey({}, "dns:unknown.com")).toThrow(
      'No signing key found for issuer "dns:unknown.com"',
    );
  });
});
