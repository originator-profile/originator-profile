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
import { dirname, join } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import type { CasLocation } from "../cas/source.ts";
import { CaClientError, CaClientErrorCode, isUnauthorized } from "../errors.ts";
import { parseCaConfig, type CaConfig } from "./config.ts";
import { inject } from "./inject.ts";
import { buildUnsignedCa } from "./page.ts";
import { renew } from "./renew.ts";
import { sync, UnissuablePagesError } from "./sync.ts";
import {
  expIn,
  honestSigner,
  inRoot,
  ISSUER,
  jwt,
  payloadOf,
  SELECTOR,
  textIntegrity,
} from "./test-utils.ts";

const page = (body: string, head = "") =>
  `<html lang="ja"><head><title>サイト名 | 記事</title><meta name="description" content="説明"><script type="application/ca-set+json" src="/cas/a.cas.json"></script>${head}</head><body>${body}</body></html>`;
const ARTICLE = page(
  `<article><h1 itemprop="headline">見出し</h1><time itemprop="datePublished" datetime="2026-01-01T00:00:00Z">1月1日</time><div itemprop="articleBody">本文</div></article>`,
);

const site = (over: Record<string, unknown> = {}) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ca-test-")));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const config = parseCaConfig(
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

const thrownBy = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected to throw");
};

const caError = (code: CaClientErrorCode, message?: RegExp) => ({
  name: expect.stringMatching(/Error$/),
  code,
  ...(message ? { message: expect.stringMatching(message) } : {}),
});

const configError = (field: RegExp) => caError(CaClientErrorCode.Config, field);

test("config: issuer は dns: で始まり、selectors は必須", () => {
  expect(
    thrownBy(() =>
      parseCaConfig(
        { issuer: "example.com", selectors: [{ selector: "a" }] },
        "/",
      ),
    ),
  ).toMatchObject(configError(/issuer/));
  expect(
    thrownBy(() => parseCaConfig({ issuer: "dns:example.com" }, "/")),
  ).toMatchObject(configError(/selectors/));
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

  const report = await sync(s.config, { check: true });

  expect(report.pages.map((p) => [p.pathname, p.status])).toStrictEqual([
    ["/news/a", "drifted"],
    ["/news/b", "missing"],
  ]);
  expect(report.orphans).toStrictEqual([orphan]);
});

test("sync --check: CA を作れないページがあれば失敗する", async () => {
  const s = site();
  s.writeHtml("news/a/index.html", page("<p>itemprop なし</p>"));

  const error = await sync(s.config, { check: true }).catch((e) => e);
  expect(error).toBeInstanceOf(UnissuablePagesError);
  expect(error).toBeInstanceOf(CaClientError);
  expect(error).toMatchObject({
    code: CaClientErrorCode.Validation,
    pages: [expect.objectContaining({ pathname: "/news/a" })],
  });
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
  });

  expect(signed.length).toBe(1);
  expect(signed[0].credentialSubject.id).toBe("urn:uuid:old");
  expect(signed[0].target[0].cssSelector).toBe("article");
  expect(report.issued).toStrictEqual([
    {
      pathname: "/news/a",
      cas: { kind: "file", path: s.casFile },
      action: "update",
    },
  ]);

  const again = await sync(s.config, {
    check: false,
    signer: honestSigner(signed),
  });
  expect(signed.length).toBe(1);
  expect(again.pages[0].status).toBe("ok");
  expect(again.issued).toStrictEqual([]);
});

test("sync: 照合し終えてから署名を始め、onScanned の結果は署名のあとも変わらない", async () => {
  const s = site();
  s.writeHtml("news/a/index.html", ARTICLE);
  s.writeHtml(
    "news/b/index.html",
    ARTICLE.replace("/cas/a.cas.json", "/cas/b.cas.json"),
  );
  const events: string[] = [];
  let scanned: unknown;
  let snapshot: unknown;

  const report = await sync(s.config, {
    check: false,
    signer: honestSigner(),
    onScanned: (scan) => {
      events.push(`scanned ${scan.pages.length}`);
      scanned = scan;
      snapshot = structuredClone(scan);
    },
    onIssued: (page) => events.push(`${page.action} ${page.pathname}`),
  });

  expect(events).toStrictEqual([
    "scanned 2",
    "create /news/a",
    "create /news/b",
  ]);
  expect(scanned).toStrictEqual(snapshot);
  expect(report.issued.map((page) => page.pathname)).toStrictEqual([
    "/news/a",
    "/news/b",
  ]);
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
  });

  expect(signed.length).toBe(1);
  expect(existsSync(s.casFile)).toBeTruthy();
  expect(report.pages[1].problem).toBe(`no element matches ${SELECTOR}`);
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
    sync(s.config, { check: false, signer: stale }),
  ).rejects.toMatchObject(caError(CaClientErrorCode.Verification, /\/news\/a/));
});

test("sync と renew: CA Server のエラーは code と status を保ったまま、どのページか分かる形で投げる", async () => {
  const s = site();
  inRoot(s.root);
  s.writeHtml("news/a/index.html", ARTICLE);
  s.upsertOwnCa({ exp: expIn(1) });
  const unauthorized = () =>
    Promise.reject(
      new CaClientError("CA signing failed: HTTP 401", {
        code: CaClientErrorCode.Http,
        status: 401,
      }),
    );
  const signer = { sign: unauthorized, reSign: unauthorized };

  const signError = await sync(s.config, { check: false, signer }).catch(
    (error) => error,
  );
  const renewError = await renew(s.config, { signer, all: true }).catch(
    (error) => error,
  );

  expect(isUnauthorized(signError)).toBe(true);
  expect(signError.message).toMatch(/^sign \/news\/a: /);
  expect(isUnauthorized(renewError)).toBe(true);
  expect(renewError.message).toMatch(/^renew public\/cas\/a\.cas\.json: /);
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
    (await sync(s.config, { check: true, paths })).pages.map((p) => p.pathname);
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
  expect(await pathnames(["dist/ja/**"])).toStrictEqual([
    "/ja/news/a",
    "/ja/news/b",
  ]);
  expect(await pathnames(["./dist/ja/**"])).toStrictEqual([
    "/ja/news/a",
    "/ja/news/b",
  ]);
  expect(
    await pathnames(["ja/news/a/index.html", "dist/ja/news/a/index.html"]),
  ).toStrictEqual(["/ja/news/a"]);
});

test("sync: パスを指定したときは orphan を判定しない", async () => {
  const { s } = scoped();

  const report = await sync(s.config, {
    check: true,
    paths: ["ja/news/a/index.html"],
  });

  expect(report.orphans).toBeUndefined();
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
  });
  expect(report.orphans).toStrictEqual([
    join(s.config.publicDir, "cas", "gone.cas.json"),
  ]);
});

test("sync: 一致しないパスと distDir の外のパスは失敗する", async () => {
  const { s, pathnames } = scoped();
  writeFileSync(join(s.root, "outside.html"), ARTICLE);

  const validation = caError(CaClientErrorCode.Validation);
  await expect(pathnames(["ja/news/zzz"])).rejects.toMatchObject({
    ...validation,
    message: expect.stringMatching(/^No files/),
  });
  await expect(pathnames(["ja/**/*.htm"])).rejects.toMatchObject({
    ...validation,
    message: expect.stringMatching(/^No files/),
  });
  await expect(pathnames(["outside.html"])).rejects.toMatchObject({
    ...validation,
    message: expect.stringMatching(/is outside/),
  });
});

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
  const config = parseCaConfig(
    { issuer: "dns:example.com", selectors: [{ selector: "a" }] },
    "/",
  );
  expect(config.renewWithinDays).toBe(30);
  expect(config.cas).toStrictEqual({
    mode: "file",
    path: "/cas/{path}.cas.json",
  });
  expect(
    thrownBy(() =>
      parseCaConfig(
        {
          issuer: "dns:example.com",
          selectors: [{ selector: "a" }],
          cas: { mode: "embed" },
        },
        "/",
      ),
    ),
  ).toMatchObject(configError(/cas\.mode/));
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

  const checked = await sync(s.config, { check: true });
  expect(checked.pages.map((p) => [p.pathname, p.status])).toStrictEqual([
    ["/news/a", "expiring"],
    ["/news/b", "ok"],
  ]);
  expect(checked.pages[0].expiresAt).toBeTruthy();

  const signed: UnsignedContentAttestation[] = [];
  await sync(s.config, {
    check: false,
    signer: honestSigner(signed),
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
  const casPath = (name: string) => join(s.config.publicDir, "cas", name);
  const cas = (name: string) => ({ kind: "file", path: casPath(name) });

  const notified: CasLocation[] = [];
  const report = await renew(s.config, {
    signer: honestSigner(),
    onRenewed: (location) => notified.push(location),
  });
  expect(report).toStrictEqual({
    renewed: [cas("a.cas.json"), cas("c.cas.json")],
    total: 3,
    withinDays: 30,
    all: false,
  });
  expect(notified).toStrictEqual(report.renewed);
  expect(payloadOf(readJwt(casPath("a.cas.json"))).renewed).toBeTruthy();
  expect(!payloadOf(readJwt(casPath("b.cas.json"))).renewed).toBeTruthy();

  expect(
    (
      await renew(s.config, {
        signer: honestSigner(),
        withinDays: 400,
      })
    ).renewed,
  ).toStrictEqual([cas("a.cas.json"), cas("b.cas.json"), cas("c.cas.json")]);
  expect(
    (
      await renew(s.config, {
        signer: honestSigner(),
        all: true,
        paths: ["cas/b.cas.json"],
      })
    ).renewed,
  ).toStrictEqual([cas("b.cas.json")]);
});

test("renew: HTML のパスを渡すと、そのページが参照する CAS を再署名する", async () => {
  const s = site();
  inRoot(s.root);
  s.writeHtml("news/a/index.html", ARTICLE);
  s.upsertOwnCa({ exp: expIn(10) });
  s.upsertOwnCa({ exp: expIn(10) }, "other.cas.json");

  expect(
    (
      await renew(s.config, {
        signer: honestSigner(),
        paths: ["news/a/index.html"],
      })
    ).renewed,
  ).toStrictEqual([{ kind: "file", path: s.casFile }]);
  await expect(
    renew(s.config, { signer: honestSigner(), paths: ["zzz"] }),
  ).rejects.toMatchObject(caError(CaClientErrorCode.Validation));
});

const BARE = ARTICLE.replace(/<script[^>]*><\/script>/, "");

test("inject: CAS の script タグを </head> の前に足し、他のバイト列は変えない", async () => {
  const s = site();
  const a = s.writeHtml("news/a/index.html", BARE);
  s.writeHtml("preview-news/index.html", BARE);
  const noSelector = BARE.replace(/<article>.*<\/article>/, "<p>本文なし</p>");
  const plain = s.writeHtml("plain/index.html", noSelector);

  const checked = await inject(s.config, { check: true });
  expect(checked.injected).toStrictEqual(["/news/a"]);
  expect(readFileSync(a, "utf-8")).toBe(BARE);

  await inject(s.config, { check: false });
  const tag =
    '<script type="application/ca-set+json" src="/cas/news.a.cas.json"></script>';
  const injected = readFileSync(a, "utf-8");
  expect(injected).toBe(BARE.replace("</head>", `${tag}</head>`));
  expect(readFileSync(plain, "utf-8")).toBe(noSelector);

  const again = await inject(s.config, { check: false });
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

  const checked = await inject(s.config, { check: true });
  expect(checked.injected).toStrictEqual([]);
  expect(checked.integrity).toStrictEqual(["/news/a"]);
  expect(readFileSync(tagged, "utf-8")).toBe(before);

  const report = await inject(s.config, { check: false });
  expect(report.problems).toStrictEqual([
    {
      pathname: "/news/a",
      problem: "file for src not found: /img/none.svg",
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

  const again = await inject(s.config, { check: false });
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

  const report = await inject(s.config, { check: false });

  expect(report.problems).toStrictEqual([]);
  for (const [name, { expected }] of Object.entries(pages)) {
    expect(
      readFileSync(join(s.config.distDir, name, "index.html"), "utf-8"),
    ).toBe(expected(tag.replace("{name}", name)));
  }
  expect(
    (await sync(s.config, { check: true })).pages.map((p) => [
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

  await inject(s.config, { check: false });
  expect(readFileSync(a, "utf-8")).toMatch(
    /<script type="application\/ca-set\+json">\[\]<\/script><\/head>/,
  );

  const first = await sync(s.config, {
    check: false,
    signer: honestSigner(),
  });
  const inline = { kind: "inline", htmlFile: a };
  expect(first.pages.map((p) => [p.status, p.cas])).toStrictEqual([
    ["missing", inline],
  ]);
  expect(first.issued).toStrictEqual([
    { pathname: "/news/a", cas: inline, action: "create" },
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
    (await sync(s.config, { check: true })).pages.map((p) => p.status),
  ).toStrictEqual(["ok"]);

  writeFileSync(a, signedHtml.replace("本文", "書き換えた本文"));
  const drifted = await sync(s.config, {
    check: false,
    signer: honestSigner(),
  });
  expect(drifted.pages.map((p) => p.status)).toStrictEqual(["drifted"]);
  expect(drifted.issued.map((p) => p.action)).toStrictEqual(["update"]);
  expect(
    (await sync(s.config, { check: true })).pages.map((p) => p.status),
  ).toStrictEqual(["ok"]);

  const renewed = await renew(s.config, {
    signer: honestSigner(),
    all: true,
  });
  expect(renewed.renewed).toStrictEqual([inline]);
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
  expect(() => published("2026-01-01T09:00:00")).toThrow(/time zone/);
  expect(() => published("1月1日")).toThrow(/time zone/);
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

  const checked = await sync(s.config, { check: true });
  expect(checked.pages.map((p) => [p.status, p.drift])).toStrictEqual([
    ["drifted", ["datePublished", "allowedUrl"]],
  ]);

  await sync(s.config, { check: false, signer: honestSigner() });
  expect(
    (await sync(s.config, { check: true })).pages.map((p) => p.status),
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

  const checked = await sync(s.config, { check: true });
  expect(checked.pages.map((p) => [p.pathname, p.status])).toStrictEqual([
    ["/news/a", "expiring"],
    ["/news/b", "missing"],
  ]);

  await sync(s.config, { check: false, signer: honestSigner() });
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

  await renew(s.config, { signer: honestSigner(), all: true });
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

  const injected = await inject(s.config, { check: false });
  expect(injected.injected).toStrictEqual(["/news/b"]);
  expect(readFileSync(onlyForeign, "utf-8")).toMatch(/news\.b\.cas\.json/);

  const report = await sync(s.config, { check: true });
  expect(report.pages.map((p) => [p.pathname, p.cas])).toStrictEqual([
    ["/news/a", { kind: "file", path: s.casFile }],
    [
      "/news/b",
      {
        kind: "file",
        path: join(s.config.publicDir, "cas", "news.b.cas.json"),
      },
    ],
  ]);
});

test("sync: 非推奨の application/cas+json を使うページを警告する", async () => {
  const s = site();
  s.writeHtml(
    "news/a/index.html",
    ARTICLE.replace("application/ca-set+json", "application/cas+json"),
  );
  const report = await sync(s.config, { check: true });

  expect(report.pages[0].deprecatedType).toBe(true);
});

test("config: origins は https のオリジンだけ。http は localhost だけ許す", () => {
  const origins = (values: string[]) =>
    parseCaConfig(
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
  expect(thrownBy(() => origins(["http://example.com"]))).toMatchObject(
    configError(/https/),
  );
  expect(thrownBy(() => origins(["https://example.com/news"]))).toMatchObject(
    configError(/without a path/),
  );
  expect(thrownBy(() => origins(["example.com"]))).toMatchObject(
    configError(/not a URL/),
  );
});

test("sync と renew: 参照型の CAS は publicDir と、ビルド済みの distDir の両方に書く", async () => {
  const s = site();
  inRoot(s.root);
  s.writeHtml("news/a/index.html", ARTICLE);
  const deployed = join(s.config.distDir, "cas", "a.cas.json");

  await sync(s.config, { check: false, signer: honestSigner() });
  expect(readFileSync(deployed, "utf-8")).toBe(
    readFileSync(s.casFile, "utf-8"),
  );

  await renew(s.config, { signer: honestSigner(), all: true });
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
  await sync(s.config, { check: false, signer: honestSigner() });
  const published = readFileSync(s.casFile, "utf-8");
  const expected = [{ from: s.casFile, to: deployed }];

  writeFileSync(deployed, "[]\n");
  const checked = await sync(s.config, { check: true });
  expect(checked.staleCopies).toStrictEqual(expected);
  expect(checked.pages.map((page) => page.status)).toStrictEqual(["ok"]);
  expect(readFileSync(deployed, "utf-8")).toBe("[]\n");

  rmSync(deployed);
  expect((await sync(s.config, { check: true })).staleCopies).toStrictEqual(
    expected,
  );

  const refreshed = await sync(s.config, {
    check: false,
    signer: honestSigner(),
  });
  expect(readFileSync(deployed, "utf-8")).toBe(published);
  expect(refreshed.copied).toStrictEqual([deployed]);
  expect(refreshed.issued).toStrictEqual([]);
  expect((await sync(s.config, { check: true })).staleCopies).toStrictEqual([]);
});
