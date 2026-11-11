import type { UnsignedContentAttestation } from "@originator-profile/model";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
import { dirname, join, relative } from "node:path";
import { onTestFinished, test } from "vitest";
import { json } from "./operations/json";
import { parseConfig, type CaConfig } from "./site/config";
import { init } from "./operations/init";
import { inject } from "./operations/inject";
import { buildUnsignedCa } from "./site/page";
import { renew } from "./operations/renew";
import { signCaFile } from "./operations/sign";
import { sync, UnissuablePagesError } from "./operations/sync";

const SELECTOR = "[itemprop='headline'], [itemprop='articleBody']";
const ISSUER = "dns:example.com";
const silent = { log: () => {}, error: () => {} };

const page = (body: string, head = "") =>
  `<html lang="ja"><head><title>サイト名 | 記事</title><meta name="description" content="説明"><script type="application/ca-set+json" src="/cas/a.cas.json"></script>${head}</head><body>${body}</body></html>`;
const ARTICLE = page(
  `<article><h1 itemprop="headline">見出し</h1><time itemprop="datePublished" datetime="2026-01-01T00:00:00Z">1月1日</time><div itemprop="articleBody">本文</div></article>`,
);

const jwt = (payload: Record<string, unknown>) => {
  const b64u = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${b64u({ alg: "none" })}.${b64u(payload)}.sig`;
};

const textIntegrity = (html: string, selector: string) => {
  const dom = new JSDOM(html);
  const text = Array.from(
    dom.window.document.querySelectorAll(selector),
    (element) => element.textContent ?? "",
  ).join("");
  dom.window.close();
  return `sha256-${createHash("sha256").update(text, "utf-8").digest("base64")}`;
};

const DAY_S = 24 * 60 * 60;
const expIn = (days: number) => Math.floor(Date.now() / 1000) + days * DAY_S;
const payloadOf = (token: string) =>
  JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

const honestSigner = (signed: UnsignedContentAttestation[] = []) => ({
  sign: async (uca: UnsignedContentAttestation) => {
    signed.push(uca);
    return jwt({
      issuer: uca.issuer,
      exp: expIn(365),
      credentialSubject: { id: "urn:uuid:new", ...uca.credentialSubject },
      allowedUrl: uca.allowedUrl,
      target: uca.target.map((target) =>
        target.type === "TextTargetIntegrity"
          ? {
              type: target.type,
              cssSelector: target.cssSelector,
              integrity: textIntegrity(
                String(target.content),
                String(target.cssSelector),
              ),
            }
          : target,
      ),
    });
  },
  reSign: async (payload: Record<string, unknown>) =>
    jwt({ ...payload, renewed: true, exp: expIn(365) }),
});

const site = (_t: unknown, over: Record<string, unknown> = {}) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ca-test-")));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const config = parseConfig(
    {
      issuer: ISSUER,
      distDir: "dist",
      publicDir: "public",
      origins: ["https://example.com", "http://localhost:4321"],
      selectors: [
        { match: "^/list$", selector: "main" },
        { selector: SELECTOR },
      ],
      exclude: ["/preview-"],
      defaults: { author: ["発行者"], genre: "technology" },
      ...over,
    },
    root,
  );
  const writeHtml = (path: string, html: string) => {
    const file = join(config.distDir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    return file;
  };
  const upsertOwnCa = (
    payload: Record<string, unknown>,
    name = "a.cas.json",
  ) => {
    const file = join(config.publicDir, "cas", name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify([jwt({ issuer: ISSUER, ...payload })]));
    return file;
  };
  return {
    root,
    config,
    writeHtml,
    upsertOwnCa,
    casFile: join(config.publicDir, "cas", "a.cas.json"),
  };
};

const build = (config: CaConfig, html: string, pathname = "/news/a") => {
  const dom = new JSDOM(html);
  try {
    return buildUnsignedCa({
      config,
      document: dom.window.document,
      pathname,
      recorded: undefined,
      content: "dist/news/a/index.html",
    });
  } finally {
    dom.window.close();
  }
};

test("config: issuer は dns: で始まり、selectors は必須", () => {
  assert.throws(
    () =>
      parseConfig(
        { issuer: "example.com", selectors: [{ selector: "a" }] },
        "/",
      ),
    /dns:/,
  );
  assert.throws(
    () => parseConfig({ issuer: "dns:example.com" }, "/"),
    /selectors/,
  );
});

test("page: microdata を OGP と <title> より優先して読む", (t) => {
  const { config } = site(t);

  const uca = build(config, ARTICLE);

  assert.deepStrictEqual(uca.credentialSubject, {
    type: "Article",
    headline: "見出し",
    description: "説明",
    author: ["発行者"],
    datePublished: "2026-01-01T00:00:00Z",
    genre: "technology",
  });
  assert.deepStrictEqual(uca.allowedUrl, [
    "https://example.com/news/a(/?)",
    "http://localhost:4321/news/a(/?)",
  ]);
  assert.deepStrictEqual(uca.target, [
    {
      type: "TextTargetIntegrity",
      cssSelector: SELECTOR,
      content: "dist/news/a/index.html",
    },
  ]);
});

test("page: microdata が無ければ og: と article: の meta、最後に <title> を読む", (t) => {
  const { config } = site(t);

  const uca = build(
    config,
    page(
      `<div itemprop="articleBody">本文</div><img class="target-integrity" integrity="sha256-img">`,
      `<meta property="og:title" content="OG 見出し"><meta property="article:published_time" content="2026-02-02T00:00:00Z"><meta property="og:image" content="https://example.com/og.png">`,
    ),
  );

  assert.strictEqual(uca.credentialSubject.headline, "OG 見出し");
  assert.strictEqual(
    uca.credentialSubject.datePublished,
    "2026-02-02T00:00:00Z",
  );
  assert.deepStrictEqual(uca.credentialSubject.image, {
    id: "https://example.com/og.png",
  });
  assert.deepStrictEqual(uca.target[1], {
    type: "ExternalResourceTargetIntegrity",
    integrity: "sha256-img",
  });
  assert.strictEqual(
    build(config, page(`<div itemprop="articleBody">本文</div>`))
      .credentialSubject.headline,
    "サイト名 | 記事",
  );
});

test("page: パスに合う最初の selectors を使う", (t) => {
  const { config } = site(t);

  const uca = build(config, page(`<main>一覧</main>`), "/list");

  assert.strictEqual(uca.target[0].cssSelector, "main");
});

test("sync --check: 未発行を missing、HTML が変わったものを drifted、参照の無い CAS を orphan にする", async (t) => {
  const s = site(t);
  s.writeHtml("news/a/index.html", ARTICLE);
  s.writeHtml(
    "news/b/index.html",
    ARTICLE.replace("/cas/a.cas.json", "/cas/b.cas.json"),
  );
  s.writeHtml(
    "preview-news/index.html",
    ARTICLE.replace("/cas/a.cas.json", "/cas/p.cas.json"),
  );
  s.upsertOwnCa({
    target: [
      {
        type: "TextTargetIntegrity",
        cssSelector: SELECTOR,
        integrity: "sha256-old",
      },
    ],
  });
  s.upsertOwnCa({}, "p.cas.json");
  const orphan = s.upsertOwnCa({}, "gone.cas.json");

  const report = await sync(s.config, { check: true, log: silent });

  assert.deepStrictEqual(
    report.pages.map((p) => [p.pathname, p.status]),
    [
      ["/news/a", "drifted"],
      ["/news/b", "missing"],
    ],
  );
  assert.deepStrictEqual(report.orphans, [orphan]);
});

test("sync --check: CA を作れないページがあれば失敗する", async (t) => {
  const s = site(t);
  s.writeHtml("news/a/index.html", page("<p>itemprop なし</p>"));

  await assert.rejects(
    sync(s.config, { check: true, log: silent }),
    UnissuablePagesError,
  );
});

test("sync: missing と drifted だけを署名し、CA ID と記録済み selector を引き継いで照合する", async (t) => {
  const s = site(t);
  s.writeHtml("news/a/index.html", ARTICLE);
  s.upsertOwnCa({
    credentialSubject: { id: "urn:uuid:old" },
    target: [
      {
        type: "TextTargetIntegrity",
        cssSelector: "article",
        integrity: "sha256-old",
      },
    ],
  });
  const signed: UnsignedContentAttestation[] = [];

  const report = await sync(s.config, {
    check: false,
    signer: honestSigner(signed),
    log: silent,
  });

  assert.strictEqual(signed.length, 1);
  assert.strictEqual(signed[0].credentialSubject.id, "urn:uuid:old");
  assert.strictEqual(signed[0].target[0].cssSelector, "article");
  assert.strictEqual(report.pages[0].issued, "update");

  const again = await sync(s.config, {
    check: false,
    signer: honestSigner(signed),
    log: silent,
  });
  assert.strictEqual(signed.length, 1);
  assert.strictEqual(again.pages[0].status, "ok");
});

test("sync: CA を作れないページは飛ばし、他のページは署名する", async (t) => {
  const s = site(t);
  s.writeHtml("news/a/index.html", ARTICLE);
  s.writeHtml(
    "news/b/index.html",
    page("<p>itemprop なし</p>").replace("/cas/a.cas.json", "/cas/b.cas.json"),
  );
  const signed: UnsignedContentAttestation[] = [];

  const report = await sync(s.config, {
    check: false,
    signer: honestSigner(signed),
    log: silent,
  });

  assert.strictEqual(signed.length, 1);
  assert.ok(existsSync(s.casFile));
  assert.match(report.pages[1].problem ?? "", /一致する要素がありません/);
});

test("sync: 署名結果が HTML と一致しなければ失敗する", async (t) => {
  const s = site(t);
  s.writeHtml("news/a/index.html", ARTICLE);
  const stale = {
    sign: async () =>
      jwt({
        target: [
          {
            type: "TextTargetIntegrity",
            cssSelector: SELECTOR,
            integrity: "sha256-stale",
          },
        ],
      }),
  };

  await assert.rejects(
    sync(s.config, { check: false, signer: stale, log: silent }),
    /Inline verification failed/,
  );
});

const scoped = (_t: unknown) => {
  const s = site(_t);
  s.writeHtml("ja/news/a/index.html", ARTICLE);
  s.writeHtml(
    "ja/news/b/index.html",
    ARTICLE.replace("/cas/a.cas.json", "/cas/b.cas.json"),
  );
  s.writeHtml(
    "en/news/c/index.html",
    ARTICLE.replace("/cas/a.cas.json", "/cas/c.cas.json"),
  );
  s.upsertOwnCa({}, "gone.cas.json");
  const cwd = process.cwd();
  process.chdir(s.root);
  onTestFinished(() => process.chdir(cwd));
  const pathnames = async (paths: string[]) =>
    (await sync(s.config, { check: true, paths, log: silent })).pages.map(
      (p) => p.pathname,
    );
  return { s, pathnames };
};

test("sync: パスで対象を絞れる（cwd 基準、distDir 基準、ディレクトリ、glob）", async (t) => {
  const { s, pathnames } = scoped(t);

  assert.deepStrictEqual(await pathnames(["dist/ja/news/a/index.html"]), [
    "/ja/news/a",
  ]);
  assert.deepStrictEqual(await pathnames(["ja/news/b/index.html"]), [
    "/ja/news/b",
  ]);
  assert.deepStrictEqual(await pathnames([join(s.config.distDir, "ja")]), [
    "/ja/news/a",
    "/ja/news/b",
  ]);
  assert.deepStrictEqual(await pathnames(["*/news/{a,c}/**"]), [
    "/en/news/c",
    "/ja/news/a",
  ]);
  assert.deepStrictEqual(await pathnames(["dist/ja/**"]), [
    "/ja/news/a",
    "/ja/news/b",
  ]);
  assert.deepStrictEqual(await pathnames(["./dist/ja/**"]), [
    "/ja/news/a",
    "/ja/news/b",
  ]);
  assert.deepStrictEqual(
    await pathnames(["ja/news/a/index.html", "dist/ja/news/a/index.html"]),
    ["/ja/news/a"],
  );
});

test("sync: パスを指定したときは orphan を判定しない", async (t) => {
  const { s } = scoped(t);

  const report = await sync(s.config, {
    check: true,
    paths: ["ja/news/a/index.html"],
    log: silent,
  });

  assert.deepStrictEqual(report.orphans, []);
});

test("sync: distDir そのものを指定したときは全体として扱い、orphan も判定する", async (t) => {
  const { s, pathnames } = scoped(t);

  assert.deepStrictEqual(await pathnames(["dist/"]), [
    "/en/news/c",
    "/ja/news/a",
    "/ja/news/b",
  ]);
  const report = await sync(s.config, {
    check: true,
    paths: ["dist"],
    log: silent,
  });
  assert.deepStrictEqual(report.orphans, [
    join(s.config.publicDir, "cas", "gone.cas.json"),
  ]);
});

test("sync: 一致しないパスと distDir の外のパスは失敗する", async (t) => {
  const { s, pathnames } = scoped(t);
  writeFileSync(join(s.root, "outside.html"), ARTICLE);

  await assert.rejects(pathnames(["ja/news/zzz"]), /一致するファイル/);
  await assert.rejects(pathnames(["ja/**/*.htm"]), /一致するファイル/);
  await assert.rejects(pathnames(["outside.html"]), /の外です/);
});

test("json と sign: HTML のパスを JSON に書き、署名時に読んで照合する", async (t) => {
  const s = site(t);
  const htmlFile = s.writeHtml("news/a/index.html", ARTICLE);
  const input = join(s.root, "ca.json");
  const cwd = process.cwd();
  process.chdir(s.root);
  onTestFinished(() => process.chdir(cwd));

  const { json: unsigned } = await json({ config: s.config, page: htmlFile });
  writeFileSync(input, unsigned);
  const uca = JSON.parse(readFileSync(input, "utf-8"));
  assert.strictEqual(
    uca.target[0].content,
    join("dist", "news", "a", "index.html"),
  );

  const signed: UnsignedContentAttestation[] = [];
  await signCaFile({
    input,
    out: s.casFile,
    signer: honestSigner(signed),
    root: s.root,
  });
  assert.strictEqual(signed[0].target[0].content, ARTICLE);
  assert.ok(existsSync(s.casFile));
});

const inRoot = (_t: unknown, root: string) => {
  const cwd = process.cwd();
  process.chdir(root);
  onTestFinished(() => process.chdir(cwd));
};

const readJwt = (file: string): string =>
  JSON.parse(readFileSync(file, "utf-8"))[0];

const matching = (
  config: CaConfig,
  html: string,
  exp: number,
  pathname = "/news/a",
) => {
  const uca = build(config, html, pathname);
  return {
    exp,
    credentialSubject: uca.credentialSubject,
    allowedUrl: uca.allowedUrl,
    target: [
      {
        type: "TextTargetIntegrity",
        cssSelector: SELECTOR,
        integrity: textIntegrity(html, SELECTOR),
      },
    ],
  };
};

test("config: renewWithinDays と cas の既定値と検証", () => {
  const config = parseConfig(
    { issuer: "dns:example.com", selectors: [{ selector: "a" }] },
    "/",
  );
  assert.strictEqual(config.renewWithinDays, 30);
  assert.deepStrictEqual(config.cas, {
    mode: "file",
    path: "/cas/{path}.cas.json",
  });
  assert.throws(
    () =>
      parseConfig(
        {
          issuer: "dns:example.com",
          selectors: [{ selector: "a" }],
          cas: { mode: "embed" },
        },
        "/",
      ),
    /cas.mode/,
  );
});

test("sync: HTML と一致していても期限が近い CAS は expiring として作り直す", async (t) => {
  const s = site(t);
  s.writeHtml("news/a/index.html", ARTICLE);
  s.writeHtml(
    "news/b/index.html",
    ARTICLE.replace("/cas/a.cas.json", "/cas/b.cas.json"),
  );
  const a = matching(s.config, ARTICLE, expIn(10));
  s.upsertOwnCa({
    ...a,
    credentialSubject: { id: "urn:uuid:a", ...a.credentialSubject },
  });
  s.upsertOwnCa(
    matching(s.config, ARTICLE, expIn(100), "/news/b"),
    "b.cas.json",
  );

  const checked = await sync(s.config, { check: true, log: silent });
  assert.deepStrictEqual(
    checked.pages.map((p) => [p.pathname, p.status]),
    [
      ["/news/a", "expiring"],
      ["/news/b", "ok"],
    ],
  );
  assert.ok(checked.pages[0].expiresAt);

  const signed: UnsignedContentAttestation[] = [];
  await sync(s.config, {
    check: false,
    signer: honestSigner(signed),
    log: silent,
  });
  assert.strictEqual(signed.length, 1);
  assert.strictEqual(signed[0].credentialSubject.id, "urn:uuid:a");
  assert.ok(payloadOf(readJwt(s.casFile)).exp > expIn(300));
});

test("renew: 期限が近い CAS と exp の無い CAS だけを再署名し、--all では全件", async (t) => {
  const s = site(t);
  inRoot(t, s.root);
  s.upsertOwnCa({ exp: expIn(10) }, "a.cas.json");
  s.upsertOwnCa({ exp: expIn(100) }, "b.cas.json");
  s.upsertOwnCa({}, "c.cas.json");
  const cas = (name: string) => join("public", "cas", name);

  const renewed = await renew(s.config, {
    signer: honestSigner(),
    log: silent,
  });
  assert.deepStrictEqual(renewed, [cas("a.cas.json"), cas("c.cas.json")]);
  assert.ok(payloadOf(readJwt(join(s.root, cas("a.cas.json")))).renewed);
  assert.ok(!payloadOf(readJwt(join(s.root, cas("b.cas.json")))).renewed);

  assert.deepStrictEqual(
    await renew(s.config, {
      signer: honestSigner(),
      log: silent,
      withinDays: 400,
    }),
    [cas("a.cas.json"), cas("b.cas.json"), cas("c.cas.json")],
  );
  assert.deepStrictEqual(
    await renew(s.config, {
      signer: honestSigner(),
      log: silent,
      all: true,
      paths: ["cas/b.cas.json"],
    }),
    [cas("b.cas.json")],
  );
});

test("renew: HTML のパスを渡すと、そのページが参照する CAS を再署名する", async (t) => {
  const s = site(t);
  inRoot(t, s.root);
  s.writeHtml("news/a/index.html", ARTICLE);
  s.upsertOwnCa({ exp: expIn(10) });
  s.upsertOwnCa({ exp: expIn(10) }, "other.cas.json");

  assert.deepStrictEqual(
    await renew(s.config, {
      signer: honestSigner(),
      log: silent,
      paths: ["news/a/index.html"],
    }),
    [join("public", "cas", "a.cas.json")],
  );
  await assert.rejects(
    renew(s.config, { signer: honestSigner(), log: silent, paths: ["zzz"] }),
    /一致するファイル/,
  );
});

const BARE = ARTICLE.replace(/<script[^>]*><\/script>/, "");

test("inject: CAS の script タグを </head> の前に足し、他のバイト列は変えない", async (t) => {
  const s = site(t);
  const a = s.writeHtml("news/a/index.html", BARE);
  s.writeHtml("preview-news/index.html", BARE);
  const noSelector = BARE.replace(/<article>.*<\/article>/, "<p>本文なし</p>");
  const plain = s.writeHtml("plain/index.html", noSelector);

  const checked = await inject(s.config, { check: true, log: silent });
  assert.deepStrictEqual(checked.injected, ["/news/a"]);
  assert.strictEqual(readFileSync(a, "utf-8"), BARE);

  await inject(s.config, { check: false, log: silent });
  const tag =
    '<script type="application/ca-set+json" src="/cas/news.a.cas.json"></script>';
  const injected = readFileSync(a, "utf-8");
  assert.strictEqual(injected, BARE.replace("</head>", `${tag}</head>`));
  assert.strictEqual(readFileSync(plain, "utf-8"), noSelector);

  const again = await inject(s.config, { check: false, log: silent });
  assert.deepStrictEqual(again.injected, []);
  assert.strictEqual(readFileSync(a, "utf-8"), injected);
});

test("inject: 外部リソースの integrity 属性をファイルのハッシュに合わせ、他のバイト列は変えない", async (t) => {
  const s = site(t);
  mkdirSync(join(s.config.distDir, "img"), { recursive: true });
  mkdirSync(join(s.config.distDir, "news"), { recursive: true });
  writeFileSync(join(s.config.distDir, "img", "logo.svg"), "<svg>logo</svg>");
  writeFileSync(join(s.config.distDir, "news", "photo.png"), "photo");
  const hash = (data: string) =>
    `sha256-${createHash("sha256").update(data).digest("base64")}`;
  const images = [
    '<img class="target-integrity" src="/img/logo.svg" alt="ロゴ">',
    '<img class="target-integrity" integrity="sha256-old" src="../photo.png"/>',
    '<img class="target-integrity" src="/img/none.svg">',
  ].join("");
  const tagged = s.writeHtml(
    "news/a/index.html",
    ARTICLE.replace("</article>", `${images}</article>`),
  );
  const before = readFileSync(tagged, "utf-8");

  const checked = await inject(s.config, { check: true, log: silent });
  assert.deepStrictEqual(checked.injected, []);
  assert.deepStrictEqual(checked.integrity, ["/news/a"]);
  assert.strictEqual(readFileSync(tagged, "utf-8"), before);

  const report = await inject(s.config, { check: false, log: silent });
  assert.deepStrictEqual(report.problems, [
    {
      pathname: "/news/a",
      problem: "src のファイルがありません: /img/none.svg",
    },
  ]);
  const written = readFileSync(tagged, "utf-8");
  assert.strictEqual(
    written,
    before
      .replace(
        'src="/img/logo.svg" alt="ロゴ">',
        `src="/img/logo.svg" alt="ロゴ" integrity="${hash("<svg>logo</svg>")}">`,
      )
      .replace('integrity="sha256-old"', `integrity="${hash("photo")}"`),
  );

  const again = await inject(s.config, { check: false, log: silent });
  assert.deepStrictEqual(again.integrity, []);
  assert.strictEqual(readFileSync(tagged, "utf-8"), written);
});

test("inject: </head> を省いた HTML、BOM 付き、head も body も省いた HTML にも入れ、sync が見つける", async (t) => {
  const s = site(t);
  const body = `<article><h1 itemprop="headline">見出し</h1><div itemprop="articleBody">本文</div></article>`;
  const head = `<title>記事</title><meta name="description" content="説明">`;
  const tag =
    '<script type="application/ca-set+json" src="/cas/{name}.cas.json"></script>';
  const pages = {
    "no-head-end": {
      html: `<html lang="ja"><head>${head}<body>${body}</body></html>`,
      expected: (t: string) =>
        `<html lang="ja"><head>${head}${t}<body>${body}</body></html>`,
    },
    bom: {
      html: `\uFEFF<html lang="ja"><head>${head}</head><body>${body}</body></html>`,
      expected: (t: string) =>
        `\uFEFF<html lang="ja"><head>${head}${t}</head><body>${body}</body></html>`,
    },
    "no-tags": {
      html: `<!doctype html>${head}${body}`,
      expected: (t: string) => `<!doctype html>${head}${t}${body}`,
    },
  };
  for (const [name, { html }] of Object.entries(pages)) {
    s.writeHtml(`${name}/index.html`, html);
  }

  const report = await inject(s.config, { check: false, log: silent });

  assert.deepStrictEqual(report.problems, []);
  for (const [name, { expected }] of Object.entries(pages)) {
    assert.strictEqual(
      readFileSync(join(s.config.distDir, name, "index.html"), "utf-8"),
      expected(tag.replace("{name}", name)),
    );
  }
  assert.deepStrictEqual(
    (await sync(s.config, { check: true, log: silent })).pages.map((p) => [
      p.pathname,
      p.status,
    ]),
    [
      ["/bom", "missing"],
      ["/no-head-end", "missing"],
      ["/no-tags", "missing"],
    ],
  );
});

test("inline: inject から sync で埋め込み CAS を署名し、ずれたら書き直し、renew もする", async (t) => {
  const s = site(t, { cas: { mode: "inline" } });
  inRoot(t, s.root);
  const a = s.writeHtml("news/a/index.html", BARE);

  await inject(s.config, { check: false, log: silent });
  assert.match(
    readFileSync(a, "utf-8"),
    /<script type="application\/ca-set\+json">\[\]<\/script><\/head>/,
  );

  const first = await sync(s.config, {
    check: false,
    signer: honestSigner(),
    log: silent,
  });
  assert.deepStrictEqual(
    first.pages.map((p) => [p.status, p.issued, p.cas]),
    [
      [
        "missing",
        "create",
        `${join("dist", "news", "a", "index.html")} (埋め込み)`,
      ],
    ],
  );
  const signedHtml = readFileSync(a, "utf-8");
  const embedded =
    /<script type="application\/ca-set\+json">(.*?)<\/script>/.exec(
      signedHtml,
    )?.[1];
  assert.ok(embedded && JSON.parse(embedded).length === 1);
  assert.strictEqual(
    signedHtml.replace(embedded, "[]"),
    BARE.replace(
      "</head>",
      '<script type="application/ca-set+json">[]</script></head>',
    ),
  );
  assert.deepStrictEqual(
    (await sync(s.config, { check: true, log: silent })).pages.map(
      (p) => p.status,
    ),
    ["ok"],
  );

  writeFileSync(a, signedHtml.replace("本文", "書き換えた本文"));
  const drifted = await sync(s.config, {
    check: false,
    signer: honestSigner(),
    log: silent,
  });
  assert.deepStrictEqual(
    drifted.pages.map((p) => [p.status, p.issued]),
    [["drifted", "update"]],
  );
  assert.deepStrictEqual(
    (await sync(s.config, { check: true, log: silent })).pages.map(
      (p) => p.status,
    ),
    ["ok"],
  );

  const renewed = await renew(s.config, {
    signer: honestSigner(),
    log: silent,
    all: true,
  });
  assert.strictEqual(renewed.length, 1);
  const after = /<script type="application\/ca-set\+json">(.*?)<\/script>/.exec(
    readFileSync(a, "utf-8"),
  )?.[1];
  assert.ok(after && payloadOf(JSON.parse(after)[0]).renewed);
  assert.match(readFileSync(a, "utf-8"), /書き換えた本文/);
});

test("page: 日付を秒とタイムゾーン付きの日時にそろえ、タイムゾーンの無い日時は CA を作れない", (t) => {
  const { config } = site(t);
  const published = (value: string) =>
    build(
      config,
      page(
        `<div itemprop="articleBody">本文</div>`,
        `<meta property="article:published_time" content="${value}">`,
      ),
    ).credentialSubject.datePublished;

  assert.strictEqual(published("2024-06-07Z"), "2024-06-07T00:00:00Z");
  assert.strictEqual(published("2025-05-07"), "2025-05-07T00:00:00Z");
  assert.strictEqual(
    published("2026-01-01T09:00+09:00"),
    "2026-01-01T09:00:00+09:00",
  );
  assert.strictEqual(
    published("2025-11-11T15:00:00.000Z"),
    "2025-11-11T15:00:00.000Z",
  );
  assert.throws(() => published("2026-01-01T09:00:00"), /タイムゾーン/);
  assert.throws(() => published("1月1日"), /タイムゾーン/);
});

test("sync: 本文が同じでも CA の項目が今のページとずれていれば drifted として作り直す", async (t) => {
  const s = site(t);
  s.writeHtml("news/a/index.html", ARTICLE);
  const current = matching(s.config, ARTICLE, expIn(300));
  s.upsertOwnCa({
    ...current,
    credentialSubject: {
      ...current.credentialSubject,
      datePublished: "2026-01-01Z",
    },
    allowedUrl: [
      current.allowedUrl,
      "https://preview.example.com/news/a(/?)",
    ].flat(),
  });

  const checked = await sync(s.config, { check: true, log: silent });
  assert.deepStrictEqual(
    checked.pages.map((p) => [p.status, p.drift]),
    [["drifted", ["datePublished", "allowedUrl"]]],
  );

  await sync(s.config, { check: false, signer: honestSigner(), log: silent });
  assert.deepStrictEqual(
    (await sync(s.config, { check: true, log: silent })).pages.map(
      (p) => p.status,
    ),
    ["ok"],
  );
});

test("sync と renew: CAS に他の発行者の CA があれば残し、自分の CA だけを差し替えるか足す", async (t) => {
  const s = site(t);
  inRoot(t, s.root);
  s.writeHtml("news/a/index.html", ARTICLE);
  s.writeHtml(
    "news/b/index.html",
    ARTICLE.replace("/cas/a.cas.json", "/cas/b.cas.json"),
  );
  const foreign = jwt({ issuer: "dns:ads.example", exp: expIn(1) });
  const own = jwt({
    issuer: ISSUER,
    ...matching(s.config, ARTICLE, expIn(10)),
  });
  mkdirSync(dirname(s.casFile), { recursive: true });
  writeFileSync(
    s.casFile,
    JSON.stringify([foreign, { attestation: own, main: true }]),
  );
  writeFileSync(
    join(s.config.publicDir, "cas", "b.cas.json"),
    JSON.stringify([foreign]),
  );

  const checked = await sync(s.config, { check: true, log: silent });
  assert.deepStrictEqual(
    checked.pages.map((p) => [p.pathname, p.status]),
    [
      ["/news/a", "expiring"],
      ["/news/b", "missing"],
    ],
  );

  await sync(s.config, { check: false, signer: honestSigner(), log: silent });
  const a = JSON.parse(readFileSync(s.casFile, "utf-8"));
  assert.strictEqual(a.length, 2);
  assert.strictEqual(a[0], foreign);
  assert.strictEqual(a[1].main, true);
  assert.ok(payloadOf(a[1].attestation).exp > expIn(300));
  const b = JSON.parse(
    readFileSync(join(s.config.publicDir, "cas", "b.cas.json"), "utf-8"),
  );
  assert.strictEqual(b[0], foreign);
  assert.strictEqual(payloadOf(b[1]).issuer, ISSUER);

  await renew(s.config, { signer: honestSigner(), log: silent, all: true });
  const renewed = JSON.parse(readFileSync(s.casFile, "utf-8"));
  assert.strictEqual(renewed[0], foreign);
  assert.ok(payloadOf(renewed[1].attestation).renewed);
});

test("sync と inject: 他オリジンの CAS の script は使わず、自分の CA を含む script を選ぶ", async (t) => {
  const s = site(t);
  const foreignTag =
    '<script type="application/ca-set+json" src="https://ads.example/cas.json"></script>';
  s.writeHtml(
    "news/a/index.html",
    ARTICLE.replace("<title>", `${foreignTag}<title>`),
  );
  const onlyForeign = s.writeHtml(
    "news/b/index.html",
    BARE.replace("</head>", `${foreignTag}</head>`),
  );

  const injected = await inject(s.config, { check: false, log: silent });
  assert.deepStrictEqual(injected.injected, ["/news/b"]);
  assert.match(readFileSync(onlyForeign, "utf-8"), /news\.b\.cas\.json/);

  const report = await sync(s.config, { check: true, log: silent });
  assert.deepStrictEqual(
    report.pages.map((p) => [p.pathname, p.cas]),
    [
      ["/news/a", join(s.config.publicDir, "cas", "a.cas.json")],
      ["/news/b", join(s.config.publicDir, "cas", "news.b.cas.json")],
    ].map(([pathname, cas]) => [pathname, relative(process.cwd(), cas)]),
  );
});

test("sync: 非推奨の application/cas+json を使うページを警告する", async (t) => {
  const s = site(t);
  s.writeHtml(
    "news/a/index.html",
    ARTICLE.replace("application/ca-set+json", "application/cas+json"),
  );
  const lines: string[] = [];

  const report = await sync(s.config, {
    check: true,
    log: { log: (line: string) => lines.push(line) },
  });

  assert.strictEqual(report.pages[0].deprecatedType, true);
  assert.ok(lines.some((line) => /application\/cas\+json/.test(line)));
});

test("config: origins は https のオリジンだけ。http は localhost だけ許す", () => {
  const origins = (values: string[]) =>
    parseConfig(
      { issuer: ISSUER, selectors: [{ selector: "a" }], origins: values },
      "/",
    ).origins;

  assert.deepStrictEqual(
    origins([
      "https://example.com/",
      "http://localhost:4321",
      "http://127.0.0.1",
    ]),
    ["https://example.com", "http://localhost:4321", "http://127.0.0.1"],
  );
  assert.throws(() => origins(["http://example.com"]), /https/);
  assert.throws(() => origins(["https://example.com/news"]), /パス/);
  assert.throws(() => origins(["example.com"]), /URL/);
});

test("sync と renew: 参照型の CAS は publicDir と、ビルド済みの distDir の両方に書く", async (t) => {
  const s = site(t);
  inRoot(t, s.root);
  s.writeHtml("news/a/index.html", ARTICLE);
  const deployed = join(s.config.distDir, "cas", "a.cas.json");

  await sync(s.config, { check: false, signer: honestSigner(), log: silent });
  assert.strictEqual(
    readFileSync(deployed, "utf-8"),
    readFileSync(s.casFile, "utf-8"),
  );

  await renew(s.config, { signer: honestSigner(), log: silent, all: true });
  assert.ok(payloadOf(readJwt(deployed)).renewed);
  assert.strictEqual(
    readFileSync(deployed, "utf-8"),
    readFileSync(s.casFile, "utf-8"),
  );
});

test("sync: distDir 側のコピーが publicDir と違うか無ければ、--check で報告し、sync で写し直す", async (t) => {
  const s = site(t);
  inRoot(t, s.root);
  s.writeHtml("news/a/index.html", ARTICLE);
  const deployed = join(s.config.distDir, "cas", "a.cas.json");
  await sync(s.config, { check: false, signer: honestSigner(), log: silent });
  const published = readFileSync(s.casFile, "utf-8");
  const expected = [{ from: s.casFile, to: deployed }];

  writeFileSync(deployed, "[]\n");
  const checked = await sync(s.config, { check: true, log: silent });
  assert.deepStrictEqual(checked.staleCopies, expected);
  assert.deepStrictEqual(
    checked.pages.map((page) => page.status),
    ["ok"],
  );
  assert.strictEqual(readFileSync(deployed, "utf-8"), "[]\n");

  rmSync(deployed);
  assert.deepStrictEqual(
    (await sync(s.config, { check: true, log: silent })).staleCopies,
    expected,
  );

  const lines: string[] = [];
  await sync(s.config, {
    check: false,
    log: { log: (line: string) => lines.push(line) },
  });
  assert.strictEqual(readFileSync(deployed, "utf-8"), published);
  assert.ok(lines.includes("✓ copy dist/cas/a.cas.json"));
  assert.deepStrictEqual(
    (await sync(s.config, { check: true, log: silent })).staleCopies,
    [],
  );
});

const fresh = (_t: unknown) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ca-init-")));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  inRoot(_t, root);
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

test("init: ビルド済み HTML から設定を作り、inject と sync でリポジトリ側と配信側に CAS ができる", async (t) => {
  const { root, configFile } = fresh(t);
  const lines: string[] = [];
  const log = { log: (line: string) => lines.push(line) };

  const config = await init({
    configFile,
    answers: { issuer: ISSUER },
    force: false,
    log,
  });

  assert.deepStrictEqual(JSON.parse(readFileSync(configFile, "utf-8")), {
    issuer: ISSUER,
    distDir: "dist",
    publicDir: "public",
    origins: ["https://example.com"],
    selectors: [{ selector: SELECTOR }],
    cas: { mode: "file" },
  });
  assert.ok(
    lines.includes(
      "CA を作れるページ 2、作れないページ 1、selector に当たらないページ 1",
    ),
  );
  assert.ok(lines.some((line) => /description が必要です: \/about/.test(line)));
  assert.ok(
    lines.some((line) => /4 \/ 4 の CA には author が入りません/.test(line)),
  );

  await inject(config, { check: false, log: silent });
  await sync(config, { check: false, signer: honestSigner(), log: silent });
  for (const dir of ["public", "dist"]) {
    assert.ok(existsSync(join(root, dir, "cas", "news.a.cas.json")));
  }
});

test("init: 何度実行しても同じ設定を書き、違う内容の上書きは --force が要る", async (t) => {
  const { configFile } = fresh(t);
  const options = {
    configFile,
    answers: { issuer: ISSUER },
    force: false,
    log: silent,
  };
  await init(options);
  const first = readFileSync(configFile, "utf-8");

  const lines: string[] = [];
  await init({ ...options, log: { log: (line: string) => lines.push(line) } });
  assert.strictEqual(readFileSync(configFile, "utf-8"), first);
  assert.ok(lines.includes("ca.config.json は変わりません"));
  assert.ok(!lines.some((line) => line.includes("を書きました")));

  const other = { ...options, answers: { issuer: ISSUER, selector: "main" } };
  await assert.rejects(init(other), /--force/);
  assert.strictEqual(readFileSync(configFile, "utf-8"), first);

  await init({ ...other, force: true });
  assert.match(readFileSync(configFile, "utf-8"), /"selector": "main"/);
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

test("init: 端末では全項目を推定値を既定にして順に聞き、不正な答えは聞き直す", async (t) => {
  const { configFile } = fresh(t);
  const lines: string[] = [];
  const { ask, asked } = scripted([
    [/issuer/, "example.com"],
    [/issuer/, ISSUER],
    [/オリジン/, "http://example.com"],
    [/オリジン/, "https://example.com, http://localhost:4321"],
    [/著者/, "Example Inc., Jane Doe"],
    [/ジャンル/, "technology"],
    [/正規表現/, "^/about"],
    [/置き場所/, "rebuild"],
  ]);

  await init({
    configFile,
    answers: {},
    force: false,
    ask,
    log: { log: (line: string) => lines.push(line) },
  });

  assert.deepStrictEqual(
    asked.map(({ question, fallback }) => [
      question.split(/[（。]/)[0],
      fallback,
    ]),
    [
      ["ビルド済み HTML のディレクトリ", "dist"],
      ["issuer", undefined],
      ["issuer", undefined],
      ["サイトのオリジン", "https://example.com"],
      ["サイトのオリジン", "https://example.com"],
      ["証明する要素の selector", SELECTOR],
      ["author が無いページの著者", ""],
      ["編集者", "Example Inc., Jane Doe"],
      ["article:section が無いページのジャンル", ""],
      ["対象にしないパスの正規表現", ""],
      ["CAS の置き場所", "commit"],
    ],
  );
  assert.ok(lines.includes('  <meta name="author"> が無いページ: 4 / 4'));
  assert.ok(lines.some((line) => /dns: で始まる/.test(line)));
  assert.ok(lines.some((line) => /description が必要です: \/about/.test(line)));
  assert.deepStrictEqual(JSON.parse(readFileSync(configFile, "utf-8")), {
    issuer: ISSUER,
    distDir: "dist",
    origins: ["https://example.com", "http://localhost:4321"],
    selectors: [{ selector: SELECTOR }],
    exclude: ["^/about"],
    defaults: {
      author: ["Example Inc.", "Jane Doe"],
      editor: ["Example Inc.", "Jane Doe"],
      genre: "technology",
    },
    cas: { mode: "inline" },
  });
  assert.ok(
    lines.includes(
      "CA を作れるページ 2、作れないページ 0、selector に当たらないページ 1",
    ),
  );
});

test("init: フラグで渡した項目は聞かず、端末でなければ issuer が無いと失敗する", async (t) => {
  const { configFile } = fresh(t);

  await assert.rejects(
    init({ configFile, answers: {}, force: false, log: silent }),
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
      persistence: "commit",
    },
    force: false,
    ask,
    log: silent,
  });
  assert.deepStrictEqual(
    asked.map(({ question }) => question.split(/[（。]/)[0]),
    ["CAS を置く静的ファイルのディレクトリ"],
  );
  const written = JSON.parse(readFileSync(configFile, "utf-8"));
  assert.strictEqual(written.publicDir, "public");
  assert.deepStrictEqual(written.defaults, { author: ["Example Inc."] });
});

test("init: HTML に author と article:section があれば、聞くのは HTML に無い編集者だけ", async (t) => {
  const { configFile, write, article } = fresh(t);
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
    force: false,
    ask,
    log: silent,
  });

  assert.deepStrictEqual(
    asked.map(({ question }) => question.split(/[（。]/)[0]),
    ["編集者", "CAS の置き場所", "CAS を置く静的ファイルのディレクトリ"],
  );
  assert.strictEqual(
    JSON.parse(readFileSync(configFile, "utf-8")).defaults,
    undefined,
  );
});
