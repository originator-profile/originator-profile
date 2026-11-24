import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import {
  distCandidates,
  proposeConfig,
  scanSite,
  SELECTOR_CANDIDATES,
  suggestSelector,
  type SiteScan,
} from "./site-init.ts";
import { ISSUER, SELECTOR } from "./test-utils.ts";

const scanOf = (over: Partial<SiteScan> = {}): SiteScan => ({
  distDir: "/tmp/dist",
  pages: 0,
  origins: [],
  selectors: SELECTOR_CANDIDATES.map((selector) => ({ selector, pages: 0 })),
  withoutAuthor: 0,
  withoutGenre: 0,
  ...over,
});

const withPages = (pages: number, counts: number[]): SiteScan =>
  scanOf({
    pages,
    selectors: SELECTOR_CANDIDATES.map((selector, index) => ({
      selector,
      pages: counts[index] ?? 0,
    })),
  });

const fresh = () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ca-site-init-")));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const write = (path: string, html: string) => {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
  };
  return { root, write };
};

test("suggestSelector: 過半数に当たる候補を返す", () => {
  expect(suggestSelector(withPages(10, [6, 3, 1]))).toBe(
    SELECTOR_CANDIDATES[0],
  );
  expect(suggestSelector(withPages(10, [3, 6, 1]))).toBe(
    SELECTOR_CANDIDATES[1],
  );
});

test("suggestSelector: 過半数がなければ最多ヒットを返す", () => {
  expect(suggestSelector(withPages(10, [4, 3, 2]))).toBe(
    SELECTOR_CANDIDATES[0],
  );
  expect(suggestSelector(withPages(10, [2, 4, 3]))).toBe(
    SELECTOR_CANDIDATES[1],
  );
});

test("suggestSelector: 同数なら定義順の先勝ち", () => {
  expect(suggestSelector(withPages(10, [5, 5, 0]))).toBe(
    SELECTOR_CANDIDATES[0],
  );
});

test("suggestSelector: ヒットがなければ undefined", () => {
  expect(suggestSelector(withPages(10, [0, 0, 0]))).toBeUndefined();
});

test("distCandidates: HTML がある候補だけを件数降順で返す", async () => {
  const { root, write } = fresh();
  write("dist/a.html", "<html></html>");
  write("dist/b.html", "<html></html>");
  write("out/c.html", "<html></html>");
  mkdirSync(join(root, "build"), { recursive: true });

  expect(await distCandidates(root)).toStrictEqual([
    { dir: resolve(root, "dist"), pages: 2 },
    { dir: resolve(root, "out"), pages: 1 },
  ]);
});

test("scanSite: origin / selector / メタ不足を集計する", async () => {
  const { root, write } = fresh();
  write(
    "dist/a.html",
    `<html><head><link rel="canonical" href="https://example.com/a"><meta name="author" content="著者"><meta property="article:section" content="tech"></head><body><article>本文</article></body></html>`,
  );
  write(
    "dist/b.html",
    `<html><head><meta property="og:url" content="https://example.com/b"></head><body><main>本文</main></body></html>`,
  );
  mkdirSync(join(root, "public"), { recursive: true });

  const scan = await scanSite(root, join(root, "dist"));
  expect(scan.pages).toBe(2);
  expect(scan.origins).toStrictEqual([
    { origin: "https://example.com", pages: 2 },
  ]);
  expect(scan.selectors).toStrictEqual([
    { selector: SELECTOR_CANDIDATES[0], pages: 0 },
    { selector: "article", pages: 1 },
    { selector: "main", pages: 1 },
  ]);
  expect(scan.withoutAuthor).toBe(1);
  expect(scan.withoutGenre).toBe(1);
  expect(scan.publicDir).toBe(resolve(root, "public"));
});

test("proposeConfig: 回答と scan から ca.config の素材を作る", () => {
  const configDir = "/repo";
  const scan = scanOf({
    distDir: "/repo/dist",
    pages: 2,
    origins: [{ origin: "https://example.com", pages: 2 }],
    selectors: [
      { selector: SELECTOR, pages: 2 },
      { selector: "article", pages: 0 },
      { selector: "main", pages: 0 },
    ],
    publicDir: "/repo/public",
  });

  expect(
    proposeConfig(
      scan,
      {
        issuer: ISSUER,
        author: ["発行者"],
        exclude: ["/preview-*"],
      },
      configDir,
    ),
  ).toStrictEqual({
    raw: {
      issuer: ISSUER,
      distDir: "dist",
      publicDir: "public",
      origins: ["https://example.com"],
      selectors: [{ selector: SELECTOR }],
      exclude: ["/preview-*"],
      defaults: { author: ["発行者"] },
    },
  });
});

test("proposeConfig: issuer / selector が無ければ落とす", () => {
  expect(() => proposeConfig(scanOf(), {}, "/repo")).toThrow(
    "--issuer と --selector が必要です",
  );
});
