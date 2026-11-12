import type { UnsignedContentAttestation } from "@originator-profile/model";
import { JSDOM } from "jsdom";
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
import { expect, onTestFinished, test } from "vitest";
import { parseConfig, type CaConfig } from "./config.ts";
import { init } from "./init.ts";
import { inject } from "./inject.ts";
import { buildUnsignedCa } from "./page.ts";
import { renew } from "./renew.ts";
import { sync, UnissuablePagesError } from "./sync.ts";

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

const site = (over: Record<string, unknown> = {}) => {
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
  expect(() =>
    parseConfig({ issuer: "example.com", selectors: [{ selector: "a" }] }, "/"),
  ).toThrow(/dns:/);
  expect(() => parseConfig({ issuer: "dns:example.com" }, "/")).toThrow(
    /selectors/,
  );
});

test("page: microdata を OGP と <title> より優先して読む", () => {
  const { config } = site();

  const uca = build(config, ARTICLE);

  expect(uca.credentialSubject).toStrictEqual({
    type: "Article",
    headline: "見出し",
    description: "説明",
    author: ["発行者"],
    datePublished: "2026-01-01T00:00:00Z",
    genre: "technology",
  });
  expect(uca.allowedUrl).toStrictEqual([
    "https://example.com/news/a(/?)",
    "http://localhost:4321/news/a(/?)",
  ]);
  expect(uca.target).toStrictEqual([
    {
      type: "TextTargetIntegrity",
      cssSelector: SELECTOR,
      content: "dist/news/a/index.html",
    },
  ]);
});

test("page: microdata が無ければ og: と article: の meta、最後に <title> を読む", () => {
  const { config } = site();

  const uca = build(
    config,
    page(
      `<div itemprop="articleBody">本文</div><img class="target-integrity" integrity="sha256-img">`,
      `<meta property="og:title" content="OG 見出し"><meta property="article:published_time" content="2026-02-02T00:00:00Z"><meta property="og:image" content="https://example.com/og.png">`,
    ),
  );

  expect(uca.credentialSubject.headline).toBe("OG 見出し");
  expect(uca.credentialSubject.datePublished).toBe("2026-02-02T00:00:00Z");
  expect(uca.credentialSubject.image).toStrictEqual({
    id: "https://example.com/og.png",
  });
  expect(uca.target[1]).toStrictEqual({
    type: "ExternalResourceTargetIntegrity",
    integrity: "sha256-img",
  });
  expect(
    build(config, page(`<div itemprop="articleBody">本文</div>`))
      .credentialSubject.headline,
  ).toBe("サイト名 | 記事");
});

test("page: パスに合う最初の selectors を使う", () => {
  const { config } = site();

  const uca = build(config, page(`<main>一覧</main>`), "/list");

  expect(uca.target[0].cssSelector).toBe("main");
});

test("sync --check: 未発行を missing、HTML が変わったものを drifted、参照の無い CAS を orphan にする", async () => {
  const s = site();
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

  expect(report.pages.map((p) => [p.pathname, p.status])).toStrictEqual([
    ["/news/a", "drifted"],
    ["/news/b", "missing"],
  ]);
  expect(report.orphans).toStrictEqual([orphan]);
});

test("sync --check: CA を作れないページがあれば失敗する", async () => {
  const s = site();
  s.writeHtml("news/a/index.html", page("<p>itemprop なし</p>"));

  await expect(sync(s.config, { check: true, log: silent })).rejects.toThrow(
    UnissuablePagesError,
  );
});

test("sync: missing と drifted だけを署名し、CA ID と記録済み selector を引き継いで照合する", async () => {
  const s = site();
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

  expect(signed.length).toBe(1);
  expect(signed[0].credentialSubject.id).toBe("urn:uuid:old");
  expect(signed[0].target[0].cssSelector).toBe("article");
  expect(report.pages[0].issued).toBe("update");

  const again = await sync(s.config, {
    check: false,
    signer: honestSigner(signed),
    log: silent,
  });
  expect(signed.length).toBe(1);
  expect(again.pages[0].status).toBe("ok");
});

test("sync: CA を作れないページは飛ばし、他のページは署名する", async () => {
  const s = site();
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

  expect(signed.length).toBe(1);
  expect(existsSync(s.casFile)).toBeTruthy();
  expect(report.pages[1].problem ?? "").toMatch(/一致する要素がありません/);
});

test("sync: 署名結果が HTML と一致しなければ失敗する", async () => {
  const s = site();
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

  await expect(
    sync(s.config, { check: false, signer: stale, log: silent }),
  ).rejects.toThrow(/Inline verification failed/);
});

const scoped = () => {
  const s = site();
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

test("sync: パスで対象を絞れる（cwd 基準、distDir 基準、ディレクトリ、glob）", async () => {
  const { s, pathnames } = scoped();

  expect(await pathnames(["dist/ja/news/a/index.html"])).toStrictEqual([
    "/ja/news/a",
  ]);
  expect(await pathnames(["ja/news/b/index.html"])).toStrictEqual([
    "/ja/news/b",
  ]);
  expect(await pathnames([join(s.config.distDir, "ja")])).toStrictEqual([
    "/ja/news/a",
    "/ja/news/b",
  ]);
  expect(await pathnames(["*/news/{a,c}/**"])).toStrictEqual([
    "/en/news/c",
    "/ja/news/a",
  ]);
  for (const glob of ["dist/ja/**", "./dist/ja/**"]) {
    expect(await pathnames([glob])).toStrictEqual(["/ja/news/a", "/ja/news/b"]);
  }
  expect(
    await pathnames(["ja/news/a/index.html", "dist/ja/news/a/index.html"]),
  ).toStrictEqual(["/ja/news/a"]);
});

test("sync: パスを指定したときは orphan を判定しない", async () => {
  const { s } = scoped();

  const report = await sync(s.config, {
    check: true,
    paths: ["ja/news/a/index.html"],
    log: silent,
  });

  expect(report.orphans).toStrictEqual([]);
});

test("sync: distDir そのものを指定したときは全体として扱い、orphan も判定する", async () => {
  const { s, pathnames } = scoped();

  expect(await pathnames(["dist/"])).toStrictEqual([
    "/en/news/c",
    "/ja/news/a",
    "/ja/news/b",
  ]);
  const report = await sync(s.config, {
    check: true,
    paths: ["dist"],
    log: silent,
  });
  expect(report.orphans).toStrictEqual([
    join(s.config.publicDir, "cas", "gone.cas.json"),
  ]);
});

test("sync: 一致しないパスと distDir の外のパスは失敗する", async () => {
  const { s, pathnames } = scoped();
  writeFileSync(join(s.root, "outside.html"), ARTICLE);

  await expect(pathnames(["ja/news/zzz"])).rejects.toThrow(/一致するファイル/);
  await expect(pathnames(["ja/**/*.htm"])).rejects.toThrow(/一致するファイル/);
  await expect(pathnames(["outside.html"])).rejects.toThrow(/の外です/);
});

const inRoot = (root: string) => {
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
  expect(config.renewWithinDays).toBe(30);
  expect(config.cas).toStrictEqual({
    mode: "file",
    path: "/cas/{path}.cas.json",
  });
  expect(() =>
    parseConfig(
      {
        issuer: "dns:example.com",
        selectors: [{ selector: "a" }],
        cas: { mode: "embed" },
      },
      "/",
    ),
  ).toThrow(/cas.mode/);
});

test("sync: HTML と一致していても期限が近い CAS は expiring として作り直す", async () => {
  const s = site();
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
  expect(checked.pages.map((p) => [p.pathname, p.status])).toStrictEqual([
    ["/news/a", "expiring"],
    ["/news/b", "ok"],
  ]);
  expect(checked.pages[0].expiresAt).toBeTruthy();

  const signed: UnsignedContentAttestation[] = [];
  await sync(s.config, {
    check: false,
    signer: honestSigner(signed),
    log: silent,
  });
  expect(signed.length).toBe(1);
  expect(signed[0].credentialSubject.id).toBe("urn:uuid:a");
  expect(payloadOf(readJwt(s.casFile)).exp > expIn(300)).toBeTruthy();
});

test("renew: 期限が近い CAS と exp の無い CAS だけを再署名し、--all では全件", async () => {
  const s = site();
  inRoot(s.root);
  s.upsertOwnCa({ exp: expIn(10) }, "a.cas.json");
  s.upsertOwnCa({ exp: expIn(100) }, "b.cas.json");
  s.upsertOwnCa({}, "c.cas.json");
  const cas = (name: string) => join("public", "cas", name);

  const renewed = await renew(s.config, {
    signer: honestSigner(),
    log: silent,
  });
  expect(renewed).toStrictEqual([cas("a.cas.json"), cas("c.cas.json")]);
  expect(
    payloadOf(readJwt(join(s.root, cas("a.cas.json")))).renewed,
  ).toBeTruthy();
  expect(
    !payloadOf(readJwt(join(s.root, cas("b.cas.json")))).renewed,
  ).toBeTruthy();

  expect(
    await renew(s.config, {
      signer: honestSigner(),
      log: silent,
      withinDays: 400,
    }),
  ).toStrictEqual([cas("a.cas.json"), cas("b.cas.json"), cas("c.cas.json")]);
  expect(
    await renew(s.config, {
      signer: honestSigner(),
      log: silent,
      all: true,
      paths: ["cas/b.cas.json"],
    }),
  ).toStrictEqual([cas("b.cas.json")]);
});

test("renew: HTML のパスを渡すと、そのページが参照する CAS を再署名する", async () => {
  const s = site();
  inRoot(s.root);
  s.writeHtml("news/a/index.html", ARTICLE);
  s.upsertOwnCa({ exp: expIn(10) });
  s.upsertOwnCa({ exp: expIn(10) }, "other.cas.json");

  expect(
    await renew(s.config, {
      signer: honestSigner(),
      log: silent,
      paths: ["news/a/index.html"],
    }),
  ).toStrictEqual([join("public", "cas", "a.cas.json")]);
  await expect(
    renew(s.config, { signer: honestSigner(), log: silent, paths: ["zzz"] }),
  ).rejects.toThrow(/一致するファイル/);
});

const BARE = ARTICLE.replace(/<script[^>]*><\/script>/, "");

test("inject: CAS の script タグを </head> の前に足し、他のバイト列は変えない", async () => {
  const s = site();
  const a = s.writeHtml("news/a/index.html", BARE);
  s.writeHtml("preview-news/index.html", BARE);
  const noSelector = BARE.replace(/<article>.*<\/article>/, "<p>本文なし</p>");
  const plain = s.writeHtml("plain/index.html", noSelector);

  const checked = await inject(s.config, { check: true, log: silent });
  expect(checked.injected).toStrictEqual(["/news/a"]);
  expect(readFileSync(a, "utf-8")).toBe(BARE);

  await inject(s.config, { check: false, log: silent });
  const tag =
    '<script type="application/ca-set+json" src="/cas/news.a.cas.json"></script>';
  const injected = readFileSync(a, "utf-8");
  expect(injected).toBe(BARE.replace("</head>", `${tag}</head>`));
  expect(readFileSync(plain, "utf-8")).toBe(noSelector);

  const again = await inject(s.config, { check: false, log: silent });
  expect(again.injected).toStrictEqual([]);
  expect(readFileSync(a, "utf-8")).toBe(injected);
});

test("inject: 外部リソースの integrity 属性をファイルのハッシュに合わせ、他のバイト列は変えない", async () => {
  const s = site();
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
  expect(checked.injected).toStrictEqual([]);
  expect(checked.integrity).toStrictEqual(["/news/a"]);
  expect(readFileSync(tagged, "utf-8")).toBe(before);

  const report = await inject(s.config, { check: false, log: silent });
  expect(report.problems).toStrictEqual([
    {
      pathname: "/news/a",
      problem: "src のファイルがありません: /img/none.svg",
    },
  ]);
  const written = readFileSync(tagged, "utf-8");
  expect(written).toBe(
    before
      .replace(
        'src="/img/logo.svg" alt="ロゴ">',
        `src="/img/logo.svg" alt="ロゴ" integrity="${hash("<svg>logo</svg>")}">`,
      )
      .replace('integrity="sha256-old"', `integrity="${hash("photo")}"`),
  );

  const again = await inject(s.config, { check: false, log: silent });
  expect(again.integrity).toStrictEqual([]);
  expect(readFileSync(tagged, "utf-8")).toBe(written);
});

test("inject: </head> を省いた HTML、BOM 付き、head も body も省いた HTML にも入れ、sync が見つける", async () => {
  const s = site();
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

  expect(report.problems).toStrictEqual([]);
  for (const [name, { expected }] of Object.entries(pages)) {
    expect(
      readFileSync(join(s.config.distDir, name, "index.html"), "utf-8"),
    ).toBe(expected(tag.replace("{name}", name)));
  }
  expect(
    (await sync(s.config, { check: true, log: silent })).pages.map((p) => [
      p.pathname,
      p.status,
    ]),
  ).toStrictEqual([
    ["/bom", "missing"],
    ["/no-head-end", "missing"],
    ["/no-tags", "missing"],
  ]);
});

test("inline: inject から sync で埋め込み CAS を署名し、ずれたら書き直し、renew もする", async () => {
  const s = site({ cas: { mode: "inline" } });
  inRoot(s.root);
  const a = s.writeHtml("news/a/index.html", BARE);

  await inject(s.config, { check: false, log: silent });
  expect(readFileSync(a, "utf-8")).toMatch(
    /<script type="application\/ca-set\+json">\[\]<\/script><\/head>/,
  );

  const first = await sync(s.config, {
    check: false,
    signer: honestSigner(),
    log: silent,
  });
  expect(first.pages.map((p) => [p.status, p.issued, p.cas])).toStrictEqual([
    [
      "missing",
      "create",
      `${join("dist", "news", "a", "index.html")} (埋め込み)`,
    ],
  ]);
  const signedHtml = readFileSync(a, "utf-8");
  const embedded =
    /<script type="application\/ca-set\+json">(.*?)<\/script>/.exec(
      signedHtml,
    )?.[1];
  expect(JSON.parse(embedded ?? "[]")).toHaveLength(1);
  expect(signedHtml.replace(embedded ?? "", "[]")).toBe(
    BARE.replace(
      "</head>",
      '<script type="application/ca-set+json">[]</script></head>',
    ),
  );
  expect(
    (await sync(s.config, { check: true, log: silent })).pages.map(
      (p) => p.status,
    ),
  ).toStrictEqual(["ok"]);

  writeFileSync(a, signedHtml.replace("本文", "書き換えた本文"));
  const drifted = await sync(s.config, {
    check: false,
    signer: honestSigner(),
    log: silent,
  });
  expect(drifted.pages.map((p) => [p.status, p.issued])).toStrictEqual([
    ["drifted", "update"],
  ]);
  expect(
    (await sync(s.config, { check: true, log: silent })).pages.map(
      (p) => p.status,
    ),
  ).toStrictEqual(["ok"]);

  const renewed = await renew(s.config, {
    signer: honestSigner(),
    log: silent,
    all: true,
  });
  expect(renewed.length).toBe(1);
  const after = /<script type="application\/ca-set\+json">(.*?)<\/script>/.exec(
    readFileSync(a, "utf-8"),
  )?.[1];
  expect(after && payloadOf(JSON.parse(after)[0]).renewed).toBeTruthy();
  expect(readFileSync(a, "utf-8")).toMatch(/書き換えた本文/);
});

test("page: 日付を秒とタイムゾーン付きの日時にそろえ、タイムゾーンの無い日時は CA を作れない", () => {
  const { config } = site();
  const published = (value: string) =>
    build(
      config,
      page(
        `<div itemprop="articleBody">本文</div>`,
        `<meta property="article:published_time" content="${value}">`,
      ),
    ).credentialSubject.datePublished;

  expect(published("2024-06-07Z")).toBe("2024-06-07T00:00:00Z");
  expect(published("2025-05-07")).toBe("2025-05-07T00:00:00Z");
  expect(published("2026-01-01T09:00+09:00")).toBe("2026-01-01T09:00:00+09:00");
  expect(published("2025-11-11T15:00:00.000Z")).toBe(
    "2025-11-11T15:00:00.000Z",
  );
  expect(() => published("2026-01-01T09:00:00")).toThrow(/タイムゾーン/);
  expect(() => published("1月1日")).toThrow(/タイムゾーン/);
});

test("sync: 本文が同じでも CA の項目が今のページとずれていれば drifted として作り直す", async () => {
  const s = site();
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
  expect(checked.pages.map((p) => [p.status, p.drift])).toStrictEqual([
    ["drifted", ["datePublished", "allowedUrl"]],
  ]);

  await sync(s.config, { check: false, signer: honestSigner(), log: silent });
  expect(
    (await sync(s.config, { check: true, log: silent })).pages.map(
      (p) => p.status,
    ),
  ).toStrictEqual(["ok"]);
});

test("sync と renew: CAS に他の発行者の CA があれば残し、自分の CA だけを差し替えるか足す", async () => {
  const s = site();
  inRoot(s.root);
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
  expect(checked.pages.map((p) => [p.pathname, p.status])).toStrictEqual([
    ["/news/a", "expiring"],
    ["/news/b", "missing"],
  ]);

  await sync(s.config, { check: false, signer: honestSigner(), log: silent });
  const a = JSON.parse(readFileSync(s.casFile, "utf-8"));
  expect(a.length).toBe(2);
  expect(a[0]).toBe(foreign);
  expect(a[1].main).toBe(true);
  expect(payloadOf(a[1].attestation).exp > expIn(300)).toBeTruthy();
  const b = JSON.parse(
    readFileSync(join(s.config.publicDir, "cas", "b.cas.json"), "utf-8"),
  );
  expect(b[0]).toBe(foreign);
  expect(payloadOf(b[1]).issuer).toBe(ISSUER);

  await renew(s.config, { signer: honestSigner(), log: silent, all: true });
  const renewed = JSON.parse(readFileSync(s.casFile, "utf-8"));
  expect(renewed[0]).toBe(foreign);
  expect(payloadOf(renewed[1].attestation).renewed).toBeTruthy();
});

test("sync と inject: 他オリジンの CAS の script は使わず、自分の CA を含む script を選ぶ", async () => {
  const s = site();
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
  expect(injected.injected).toStrictEqual(["/news/b"]);
  expect(readFileSync(onlyForeign, "utf-8")).toMatch(/news\.b\.cas\.json/);

  const report = await sync(s.config, { check: true, log: silent });
  expect(report.pages.map((p) => [p.pathname, p.cas])).toStrictEqual(
    [
      ["/news/a", join(s.config.publicDir, "cas", "a.cas.json")],
      ["/news/b", join(s.config.publicDir, "cas", "news.b.cas.json")],
    ].map(([pathname, cas]) => [pathname, relative(process.cwd(), cas)]),
  );
});

test("sync: 非推奨の application/cas+json を使うページを警告する", async () => {
  const s = site();
  s.writeHtml(
    "news/a/index.html",
    ARTICLE.replace("application/ca-set+json", "application/cas+json"),
  );
  const lines: string[] = [];

  const report = await sync(s.config, {
    check: true,
    log: { log: (line: string) => lines.push(line) },
  });

  expect(report.pages[0].deprecatedType).toBe(true);
  expect(
    lines.some((line) => /application\/cas\+json/.test(line)),
  ).toBeTruthy();
});

test("config: origins は https のオリジンだけ。http は localhost だけ許す", () => {
  const origins = (values: string[]) =>
    parseConfig(
      { issuer: ISSUER, selectors: [{ selector: "a" }], origins: values },
      "/",
    ).origins;

  expect(
    origins([
      "https://example.com/",
      "http://localhost:4321",
      "http://127.0.0.1",
    ]),
  ).toStrictEqual([
    "https://example.com",
    "http://localhost:4321",
    "http://127.0.0.1",
  ]);
  expect(() => origins(["http://example.com"])).toThrow(/https/);
  expect(() => origins(["https://example.com/news"])).toThrow(/パス/);
  expect(() => origins(["example.com"])).toThrow(/URL/);
});

test("sync と renew: 参照型の CAS は publicDir と、ビルド済みの distDir の両方に書く", async () => {
  const s = site();
  inRoot(s.root);
  s.writeHtml("news/a/index.html", ARTICLE);
  const deployed = join(s.config.distDir, "cas", "a.cas.json");

  await sync(s.config, { check: false, signer: honestSigner(), log: silent });
  expect(readFileSync(deployed, "utf-8")).toBe(
    readFileSync(s.casFile, "utf-8"),
  );

  await renew(s.config, { signer: honestSigner(), log: silent, all: true });
  expect(payloadOf(readJwt(deployed)).renewed).toBeTruthy();
  expect(readFileSync(deployed, "utf-8")).toBe(
    readFileSync(s.casFile, "utf-8"),
  );
});

test("sync: distDir 側のコピーが publicDir と違うか無ければ、--check で報告し、sync で写し直す", async () => {
  const s = site();
  inRoot(s.root);
  s.writeHtml("news/a/index.html", ARTICLE);
  const deployed = join(s.config.distDir, "cas", "a.cas.json");
  await sync(s.config, { check: false, signer: honestSigner(), log: silent });
  const published = readFileSync(s.casFile, "utf-8");
  const expected = [{ from: s.casFile, to: deployed }];

  writeFileSync(deployed, "[]\n");
  const checked = await sync(s.config, { check: true, log: silent });
  expect(checked.staleCopies).toStrictEqual(expected);
  expect(checked.pages.map((page) => page.status)).toStrictEqual(["ok"]);
  expect(readFileSync(deployed, "utf-8")).toBe("[]\n");

  rmSync(deployed);
  expect(
    (await sync(s.config, { check: true, log: silent })).staleCopies,
  ).toStrictEqual(expected);

  const lines: string[] = [];
  await sync(s.config, {
    check: false,
    log: { log: (line: string) => lines.push(line) },
  });
  expect(readFileSync(deployed, "utf-8")).toBe(published);
  expect(lines.includes("✓ copy dist/cas/a.cas.json")).toBeTruthy();
  expect(
    (await sync(s.config, { check: true, log: silent })).staleCopies,
  ).toStrictEqual([]);
});

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
    force: false,
    log,
  });

  expect(JSON.parse(readFileSync(configFile, "utf-8"))).toStrictEqual({
    issuer: ISSUER,
    distDir: "dist",
    publicDir: "public",
    origins: ["https://example.com"],
    selectors: [{ selector: SELECTOR }],
    cas: { mode: "file" },
  });
  expect(
    lines.includes(
      "CA を作れるページ 2、作れないページ 1、selector に当たらないページ 1",
    ),
  ).toBeTruthy();
  expect(
    lines.some((line) => /description が必要です: \/about/.test(line)),
  ).toBeTruthy();
  expect(
    lines.some((line) => /4 \/ 4 の CA には author が入りません/.test(line)),
  ).toBeTruthy();

  await inject(config, { check: false, log: silent });
  await sync(config, { check: false, signer: honestSigner(), log: silent });
  for (const dir of ["public", "dist"]) {
    expect(existsSync(join(root, dir, "cas", "news.a.cas.json"))).toBeTruthy();
  }
});

test("init: 何度実行しても同じ設定を書き、違う内容の上書きは --force が要る", async () => {
  const { configFile } = fresh();
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
  expect(readFileSync(configFile, "utf-8")).toBe(first);
  expect(lines.includes("ca.config.json は変わりません")).toBeTruthy();
  expect(!lines.some((line) => line.includes("を書きました"))).toBeTruthy();

  const other = { ...options, answers: { issuer: ISSUER, selector: "main" } };
  await expect(init(other)).rejects.toThrow(/--force/);
  expect(readFileSync(configFile, "utf-8")).toBe(first);

  await init({ ...other, force: true });
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

  expect(
    asked.map(({ question, fallback }) => [
      question.split(/[（。]/)[0],
      fallback,
    ]),
  ).toStrictEqual([
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
  ]);
  expect(
    lines.includes('  <meta name="author"> が無いページ: 4 / 4'),
  ).toBeTruthy();
  expect(lines.some((line) => /dns: で始まる/.test(line))).toBeTruthy();
  expect(
    lines.some((line) => /description が必要です: \/about/.test(line)),
  ).toBeTruthy();
  expect(JSON.parse(readFileSync(configFile, "utf-8"))).toStrictEqual({
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
  expect(
    lines.includes(
      "CA を作れるページ 2、作れないページ 0、selector に当たらないページ 1",
    ),
  ).toBeTruthy();
});

test("init: フラグで渡した項目は聞かず、端末でなければ issuer が無いと失敗する", async () => {
  const { configFile } = fresh();

  await expect(
    init({ configFile, answers: {}, force: false, log: silent }),
  ).rejects.toThrow(/--issuer/);

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
    force: false,
    ask,
    log: silent,
  });

  expect(
    asked.map(({ question }) => question.split(/[（。]/)[0]),
  ).toStrictEqual([
    "編集者",
    "CAS の置き場所",
    "CAS を置く静的ファイルのディレクトリ",
  ]);
  expect(JSON.parse(readFileSync(configFile, "utf-8")).defaults).toBe(
    undefined,
  );
});
