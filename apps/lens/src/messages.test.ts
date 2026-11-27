import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const messagesOf = (locale: string) =>
  Object.keys(
    JSON.parse(read(`public/_locales/${locale}/messages.json`)) as object,
  );

/** ディレクトリ以下のソースを、テストを除いて読む */
const sourcesOf = (dir: string) =>
  readdirSync(join(root, dir), { recursive: true, encoding: "utf8" })
    .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
    .map((path) => read(join(dir, path)));

/** ソース中の、文言のキーの形をした文字列リテラル */
const keysIn = (sources: string[]) =>
  new Set(
    sources.flatMap((source) =>
      [...source.matchAll(/"([A-Z][A-Za-z]*_[A-Za-z_]+)"/g)].flatMap(
        ([, key]) => (key ? [key] : []),
      ),
    ),
  );

// NOTE: 文言は chrome.i18n.getMessage で引き、キーが無ければ空文字になって
// 気付けない。キーは文字列リテラルで書き、組み立てない
describe("messages", () => {
  const ja = messagesOf("ja");
  const en = messagesOf("en");

  test("ja と en が同じキーを持つ", () => {
    expect(en.toSorted()).toEqual(ja.toSorted());
  });

  test("lens のソースが使うキーはすべて定義されている", () => {
    const used = keysIn(sourcesOf("src"));
    expect([...used].filter((key) => !ja.includes(key))).toEqual([]);
  });

  test("定義したキーはどこかで使われている", () => {
    const used = keysIn([
      ...sourcesOf("src"),
      ...sourcesOf("../../packages/extension-common/src"),
    ]);
    const manifest = read("manifest.ts");
    const unused = ja.filter(
      (key) => !used.has(key) && !manifest.includes(`__MSG_${key}__`),
    );
    expect(unused).toEqual([]);
  });
});
