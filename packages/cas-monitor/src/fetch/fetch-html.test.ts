import assert from "assert";
import { describe, test } from "node:test";
import { buildVerificationDocument, transformEndpoint } from "./fetch-html.js";

describe("transformEndpoint", () => {
  test("https が存在しない場合に https と well-known を補完する", () => {
    assert.strictEqual(
      transformEndpoint("example.com"),
      "https://example.com/.well-known/sp.json",
    );
  });
  test("origin のみの場合は well-known を補完する", () => {
    assert.strictEqual(
      transformEndpoint("https://example.com"),
      "https://example.com/.well-known/sp.json",
    );
  });
  test("末尾スラッシュ付きの origin は well-known を補完する", () => {
    assert.strictEqual(
      transformEndpoint("https://example.com/"),
      "https://example.com/.well-known/sp.json",
    );
  });
  test("origin より下位のパスを持つ URL は変更しない", () => {
    assert.strictEqual(
      transformEndpoint("https://example.com/ja/"),
      "https://example.com/ja/",
    );
  });
});

describe("buildVerificationDocument", () => {
  test("相対 src を HTML の取得元 URL を基準に絶対 URL へ解決する", () => {
    const html =
      '<html><body><img integrity="sha256-x" src="/images/a.png"></body></html>';
    const doc = buildVerificationDocument(
      html,
      "https://example.com/articles/1",
    );
    assert.strictEqual(
      doc.querySelector("img")?.getAttribute("src"),
      "https://example.com/images/a.png",
    );
  });
  test("既に絶対 URL の src はそのまま維持する", () => {
    const html =
      '<html><body><img src="https://cdn.example.com/a.png"></body></html>';
    const doc = buildVerificationDocument(
      html,
      "https://example.com/articles/1",
    );
    assert.strictEqual(
      doc.querySelector("img")?.getAttribute("src"),
      "https://cdn.example.com/a.png",
    );
  });
  test("URL として不正な src は書き換えをスキップし、検証全体を止めない", () => {
    const html = '<html><body><img src="http://"><p>ok</p></body></html>';
    assert.doesNotThrow(() => {
      buildVerificationDocument(html, "https://example.com/articles/1");
    });
    const doc = buildVerificationDocument(
      html,
      "https://example.com/articles/1",
    );
    assert.strictEqual(
      doc.querySelector("img")?.getAttribute("src"),
      "http://",
    );
  });
});
