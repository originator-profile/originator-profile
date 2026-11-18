import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { inject } from "../operations/inject.ts";
import { sync } from "../operations/sync.ts";
import {
  honestSigner,
  inRoot,
  ISSUER,
  SELECTOR,
} from "../operations/test-utils.ts";
import { init } from "./init.ts";

const silent = { log: () => {} };

const fresh = () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ca-init-")));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  inRoot(root);
  const write = (path: string, html: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), html);
  };
  const article = (path: string, extra = "") =>
    `<html lang="ja"><head><title>記事</title><meta name="description" content="説明"><link rel="canonical" href="https://example.com${path}">${extra}</head><body><article><h1 itemprop="headline">見出し</h1><div itemprop="articleBody">本文</div></article></body></html>`;
  write("dist/news/a/index.html", article("/news/a"));
  write("dist/news/b/index.html", article("/news/b"));
  write(
    "dist/about/index.html",
    article("/about").replace(/<meta name="description"[^>]*>/, ""),
  );
  write("dist/index.html", "<html><body><p>トップ</p></body></html>");
  mkdirSync(join(root, "public"));
  return { root, configFile: join(root, "ca.config.json"), write, article };
};

test("init: ビルド済み HTML から設定を作り、inject と sync でリポジトリ側と配信側に CAS ができる", async () => {
  const { root, configFile } = fresh();
  const lines: string[] = [];
  const log = { log: (line: string) => lines.push(line) };

  const config = await init({
    configFile,
    answers: { issuer: ISSUER },
    log,
  });

  expect(JSON.parse(readFileSync(configFile, "utf-8"))).toStrictEqual({
    issuer: ISSUER,
    distDir: "dist",
    publicDir: "public",
    origins: ["https://example.com"],
    selectors: [{ selector: SELECTOR }],
  });
  expect(
    lines.includes(
      "CA を作れるページ 2、作れないページ 1、セレクタに当たらないページ 1",
    ),
  ).toBeTruthy();
  expect(
    lines.some((line) => /description are required: \/about/.test(line)),
  ).toBeTruthy();
  expect(
    lines.some((line) => /4 \/ 4 の CA には author が入りません/.test(line)),
  ).toBeTruthy();

  await inject(config, { check: false });
  await sync(config, { check: false, signer: honestSigner() });
  for (const dir of ["public", "dist"]) {
    expect(existsSync(join(root, dir, "cas", "news.a.cas.json"))).toBeTruthy();
  }
});

test("init: 同じ内容なら書き直さず、違う内容なら上書きする", async () => {
  const { configFile } = fresh();
  const options = {
    configFile,
    answers: { issuer: ISSUER },
    log: silent,
  };
  await init(options);
  const first = readFileSync(configFile, "utf-8");

  const lines: string[] = [];
  await init({ ...options, log: { log: (line: string) => lines.push(line) } });
  expect(readFileSync(configFile, "utf-8")).toBe(first);
  expect(lines.includes("ca.config.json は変わりません")).toBeTruthy();
  expect(!lines.some((line) => line.includes("を書きました"))).toBeTruthy();

  await init({
    ...options,
    answers: { issuer: ISSUER, selector: "main" },
  });
  expect(readFileSync(configFile, "utf-8")).toMatch(/"selector": "main"/);
});

const scripted = (replies: [RegExp, string][]) => {
  const asked: { question: string; fallback?: string }[] = [];
  const ask = async (question: string, fallback?: string) => {
    asked.push({ question, fallback });
    const index = replies.findIndex(([pattern]) => pattern.test(question));
    if (index < 0) {
      return fallback ?? "";
    }
    const [[, reply]] = replies.splice(index, 1);
    return reply || fallback || "";
  };
  return { ask, asked };
};

test("init: 端末では全項目を推定値を既定にして順に聞き、不正な答えは聞き直す", async () => {
  const { configFile } = fresh();
  const lines: string[] = [];
  const { ask, asked } = scripted([
    [/発行者/, "example.com"],
    [/発行者/, ISSUER],
    [/サイトの URL/, "http://example.com"],
    [/サイトの URL/, "https://example.com, http://localhost:4321"],
    [/著者/, "Example Inc., Jane Doe"],
    [/ジャンル/, "technology"],
    [/正規表現/, "^/about"],
  ]);

  await init({
    configFile,
    answers: {},
    ask,
    log: { log: (line: string) => lines.push(line) },
  });

  expect(
    asked.map(({ question, fallback }) => [
      question.split(/[（。]/)[0],
      fallback,
    ]),
  ).toStrictEqual([
    ["ビルド済み HTML のディレクトリ", "dist"],
    ["発行者 ID", undefined],
    ["発行者 ID", undefined],
    ["サイトの URL", "https://example.com"],
    ["サイトの URL", "https://example.com"],
    ["証明する要素の CSS セレクタ", SELECTOR],
    ["author が無いページの著者", ""],
    ["編集者", "Example Inc., Jane Doe"],
    ["article:section が無いページのジャンル", ""],
    ["対象にしないパスの正規表現", ""],
    ["CAS を置く静的ファイルのディレクトリ", "public"],
  ]);
  expect(
    lines.includes('  <meta name="author"> が無いページ: 4 / 4'),
  ).toBeTruthy();
  expect(lines.some((line) => /starting with "dns:"/.test(line))).toBeTruthy();
  expect(
    lines.some((line) => /description are required: \/about/.test(line)),
  ).toBeTruthy();
  expect(JSON.parse(readFileSync(configFile, "utf-8"))).toStrictEqual({
    issuer: ISSUER,
    distDir: "dist",
    publicDir: "public",
    origins: ["https://example.com", "http://localhost:4321"],
    selectors: [{ selector: SELECTOR }],
    exclude: ["^/about"],
    defaults: {
      author: ["Example Inc.", "Jane Doe"],
      editor: ["Example Inc.", "Jane Doe"],
      genre: "technology",
    },
  });
  expect(
    lines.includes(
      "CA を作れるページ 2、作れないページ 0、セレクタに当たらないページ 1",
    ),
  ).toBeTruthy();
});

test("init: フラグで渡した項目は聞かず、端末でなければ issuer が無いと失敗する", async () => {
  const { configFile } = fresh();

  await expect(init({ configFile, answers: {}, log: silent })).rejects.toThrow(
    /--issuer/,
  );

  const { ask, asked } = scripted([]);
  await init({
    configFile,
    answers: {
      issuer: ISSUER,
      distDir: "dist",
      origins: ["https://example.com"],
      selector: "main",
      author: ["Example Inc."],
      editor: [],
      genre: "",
      exclude: [],
    },
    ask,
    log: silent,
  });
  expect(
    asked.map(({ question }) => question.split(/[（。]/)[0]),
  ).toStrictEqual(["CAS を置く静的ファイルのディレクトリ"]);
  const written = JSON.parse(readFileSync(configFile, "utf-8"));
  expect(written.publicDir).toBe("public");
  expect(written.defaults).toStrictEqual({ author: ["Example Inc."] });
});

test("init: HTML に author と article:section があれば、聞くのは HTML に無い編集者だけ", async () => {
  const { configFile, write, article } = fresh();
  const meta =
    '<meta name="author" content="記者"><meta property="article:section" content="科学">';
  write("dist/news/a/index.html", article("/news/a", meta));
  write("dist/news/b/index.html", article("/news/b", meta));
  write("dist/about/index.html", article("/about", meta));
  write("dist/index.html", `<html><head>${meta}</head><body></body></html>`);
  const { ask, asked } = scripted([]);

  await init({
    configFile,
    answers: {
      issuer: ISSUER,
      distDir: "dist",
      origins: [],
      selector: SELECTOR,
      exclude: [],
    },
    ask,
    log: silent,
  });

  expect(
    asked.map(({ question }) => question.split(/[（。]/)[0]),
  ).toStrictEqual(["編集者", "CAS を置く静的ファイルのディレクトリ"]);
  expect(JSON.parse(readFileSync(configFile, "utf-8")).defaults).toBe(
    undefined,
  );
});
