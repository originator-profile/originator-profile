import { Window } from "happy-dom";
import { afterEach, expect, test, vi } from "vitest";
import { fetchOpMeta } from "./fetch-op-meta";

function createDocument(scriptContents: string[]): Document {
  const window = new Window({ url: "https://example.com" });
  const scripts = scriptContents
    .map(
      (content) => `<script type="application/opmeta+json">${content}</script>`,
    )
    .join("\n");
  window.document.body.innerHTML = scripts;
  return window.document as unknown as Document;
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("OpMeta が1つ埋め込まれているとき、その OpMeta を返す", () => {
  const doc = createDocument([JSON.stringify({ targetopid: "op-123" })]);
  const result = fetchOpMeta(doc);
  expect(result).toEqual({ targetopid: "op-123" });
});

test("OpMeta が存在しないとき、undefined を返す", () => {
  const window = new Window({ url: "https://example.com" });
  window.document.body.innerHTML = "<body></body>";
  const result = fetchOpMeta(window.document as unknown as Document);
  expect(result).toBeUndefined();
});

test("複数の OpMeta 要素があるとき、先頭のみ採用し warn を出す", () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  const doc = createDocument([
    JSON.stringify({ targetopid: "first" }),
    JSON.stringify({ targetopid: "second" }),
  ]);
  const result = fetchOpMeta(doc);
  expect(result).toEqual({ targetopid: "first" });
  expect(warnSpy).toHaveBeenCalledWith(
    "Multiple OpMeta elements found. Only the first one will be used.",
  );
});

test("不正な JSON のとき、undefined を返す", () => {
  const doc = createDocument(["{ invalid json !!!"]);
  const result = fetchOpMeta(doc);
  expect(result).toBeUndefined();
});

test("targetopid が欠落しているとき、undefined を返す", () => {
  const doc = createDocument([JSON.stringify({ other: "value" })]);
  const result = fetchOpMeta(doc);
  expect(result).toBeUndefined();
});

test("targetopid が空文字のとき、undefined を返す", () => {
  const doc = createDocument([JSON.stringify({ targetopid: "" })]);
  const result = fetchOpMeta(doc);
  expect(result).toBeUndefined();
});

test("targetopid が文字列以外のとき、undefined を返す", () => {
  const doc = createDocument([JSON.stringify({ targetopid: 123 })]);
  const result = fetchOpMeta(doc);
  expect(result).toBeUndefined();
});

test("null が埋め込まれているとき、undefined を返す", () => {
  const doc = createDocument([JSON.stringify(null)]);
  const result = fetchOpMeta(doc);
  expect(result).toBeUndefined();
});

test("追加プロパティがある有効な OpMeta はそのまま返す", () => {
  const opMeta = { targetopid: "op-456", extra: "data" };
  const doc = createDocument([JSON.stringify(opMeta)]);
  const result = fetchOpMeta(doc);
  expect(result).toEqual(opMeta);
});
