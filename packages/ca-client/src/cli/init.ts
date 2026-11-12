import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import {
  parseConfig,
  parseIssuer,
  parseOrigin,
  parsePattern,
  type CaConfig,
} from "./config.ts";
import {
  buildUnsignedCa,
  isExcluded,
  pathnameOf,
  selectorFor,
  UnissuableError,
} from "./page.ts";
import { resolveFiles } from "./paths.ts";
import { parseHtml } from "./source.ts";

export type Persistence = "commit" | "rebuild";
const PERSISTENCES: Persistence[] = ["commit", "rebuild"];

const DIST_CANDIDATES = ["dist", "docs", "out", "build", "_site", "public"];
const PUBLIC_CANDIDATES = ["public", "static"];
export const SELECTOR_CANDIDATES = [
  "[itemprop='headline'], [itemprop='articleBody']",
  "article",
  "main",
];

export type SiteScan = {
  distDir: string;
  pages: number;
  origins: { origin: string; pages: number }[];
  selectors: { selector: string; pages: number }[];
  withoutAuthor: number;
  withoutGenre: number;
  publicDir?: string;
};

export type InitAnswers = {
  issuer?: string;
  distDir?: string;
  origins?: string[];
  selector?: string;
  author?: string[];
  editor?: string[];
  genre?: string;
  exclude?: string[];
  persistence?: Persistence;
  publicDir?: string;
};

export type Proposal = {
  raw: Record<string, unknown>;
  persistence: Persistence;
};

const countBy = (values: string[]) =>
  [
    ...values.reduce(
      (counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1),
      new Map<string, number>(),
    ),
  ]
    .map(([key, pages]) => ({ key, pages }))
    .sort((a, b) => b.pages - a.pages);

export const distCandidates = async (
  root: string,
): Promise<{ dir: string; pages: number }[]> =>
  (
    await Promise.all(
      DIST_CANDIDATES.map(async (name) => ({
        dir: resolve(root, name),
        pages: (await resolveFiles(resolve(root, name), [], ".html")).length,
      })),
    )
  )
    .filter(({ pages }) => pages > 0)
    .sort((a, b) => b.pages - a.pages);

export const scanSite = async (
  root: string,
  distDir: string,
): Promise<SiteScan> => {
  const files = await resolveFiles(distDir, [], ".html");
  const origins: string[] = [];
  const hits = new Map(SELECTOR_CANDIDATES.map((selector) => [selector, 0]));
  let withoutAuthor = 0;
  let withoutGenre = 0;
  for (const file of files) {
    const dom = parseHtml(await readFile(file, "utf-8"));
    try {
      const document = dom.window.document;
      const url =
        document.querySelector("link[rel='canonical']")?.getAttribute("href") ??
        document
          .querySelector("meta[property='og:url']")
          ?.getAttribute("content");
      if (url && URL.canParse(url)) {
        origins.push(new URL(url).origin);
      }
      for (const selector of SELECTOR_CANDIDATES) {
        if (document.querySelector(selector) !== null) {
          hits.set(selector, (hits.get(selector) ?? 0) + 1);
        }
      }
      if (
        !document.querySelector("meta[name='author']")?.getAttribute("content")
      ) {
        withoutAuthor++;
      }
      if (
        !document
          .querySelector("meta[property='article:section']")
          ?.getAttribute("content")
      ) {
        withoutGenre++;
      }
    } finally {
      dom.window.close();
    }
  }
  return {
    distDir,
    pages: files.length,
    origins: countBy(origins).map(({ key, pages }) => ({ origin: key, pages })),
    selectors: [...hits].map(([selector, pages]) => ({ selector, pages })),
    withoutAuthor,
    withoutGenre,
    publicDir: PUBLIC_CANDIDATES.map((name) => resolve(root, name)).find(
      (dir) => dir !== distDir && existsSync(dir),
    ),
  };
};

export const suggestSelector = (scan: SiteScan): string | undefined => {
  const hit = scan.selectors.filter(({ pages }) => pages > 0);
  return (
    hit.find(({ pages }) => pages * 2 >= scan.pages) ??
    [...hit].sort((a, b) => b.pages - a.pages)[0]
  )?.selector;
};

export const proposeConfig = (
  scan: SiteScan,
  answers: InitAnswers,
  configDir: string,
): Proposal => {
  const missing = [
    ...(answers.issuer ? [] : ["--issuer"]),
    ...((answers.selector ?? suggestSelector(scan)) ? [] : ["--selector"]),
  ];
  if (missing.length > 0) {
    throw new Error(`${missing.join(" と ")} が必要です`);
  }
  const persistence = answers.persistence ?? "commit";
  const at = (dir: string) => relative(configDir, dir) || ".";
  const origins =
    answers.origins ?? scan.origins.slice(0, 1).map(({ origin }) => origin);
  const defaults = {
    ...(answers.author?.length ? { author: answers.author } : {}),
    ...(answers.editor?.length ? { editor: answers.editor } : {}),
    ...(answers.genre ? { genre: answers.genre } : {}),
  };
  return {
    persistence,
    raw: {
      issuer: answers.issuer,
      distDir: at(scan.distDir),
      ...(persistence === "commit"
        ? {
            publicDir: at(
              answers.publicDir ??
                scan.publicDir ??
                resolve(configDir, "public"),
            ),
          }
        : {}),
      ...(origins.length > 0 ? { origins } : {}),
      selectors: [{ selector: answers.selector ?? suggestSelector(scan) }],
      ...(answers.exclude?.length ? { exclude: answers.exclude } : {}),
      ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
      cas: { mode: persistence === "commit" ? "file" : "inline" },
    },
  };
};

export type Ask = (question: string, fallback?: string) => Promise<string>;

type Log = Pick<Console, "log">;

const askValid = async <T>(
  ask: Ask,
  log: Log,
  question: string,
  fallback: string | undefined,
  parse: (value: string) => T,
): Promise<T> => {
  for (;;) {
    try {
      return parse(await ask(question, fallback));
    } catch (error) {
      log.log(`  ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};

const list = (value: string) => value.split(/[\s,]+/).filter(Boolean);
const names = (value: string) =>
  value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
const shown = (dir: string) => relative(process.cwd(), dir) || ".";

const askDistDir = async (root: string, ask: Ask, log: Log) => {
  const candidates = await distCandidates(root);
  for (const { dir, pages } of candidates) {
    log.log(`  ${shown(dir)}: HTML ${pages} ページ`);
  }
  return askValid(
    ask,
    log,
    "ビルド済み HTML のディレクトリ",
    candidates[0] && shown(candidates[0].dir),
    (value) => {
      if (!value || !existsSync(resolve(value))) {
        throw new Error(
          `${value || "（空）"} がありません。先にビルドしてください`,
        );
      }
      return value;
    },
  );
};

export const parsePersistence = (value: string): Persistence => {
  if (!PERSISTENCES.includes(value as Persistence)) {
    throw new Error(`--persistence は ${PERSISTENCES.join(" か ")}: ${value}`);
  }
  return value as Persistence;
};

export type IssuancePreview = {
  issuable: number;
  unmatched: number;
  problems: { problem: string; pages: string[] }[];
};

export const previewIssuance = async (
  config: CaConfig,
): Promise<IssuancePreview> => {
  let issuable = 0;
  let unmatched = 0;
  const problems = new Map<string, string[]>();
  for (const file of await resolveFiles(config.distDir, [], ".html")) {
    const pathname = pathnameOf(config.distDir, file);
    if (isExcluded(config, pathname)) {
      continue;
    }
    const html = await readFile(file, "utf-8");
    const dom = parseHtml(html);
    try {
      const document = dom.window.document;
      const selector = selectorFor(config, pathname, undefined);
      if (selector === undefined || document.querySelector(selector) === null) {
        unmatched++;
        continue;
      }
      buildUnsignedCa({
        config,
        document,
        pathname,
        recorded: undefined,
        content: html,
      });
      issuable++;
    } catch (error) {
      if (!(error instanceof UnissuableError)) {
        throw error;
      }
      problems.set(error.message, [
        ...(problems.get(error.message) ?? []),
        pathname,
      ]);
    } finally {
      dom.window.close();
    }
  }
  return {
    issuable,
    unmatched,
    problems: [...problems].map(([problem, pages]) => ({ problem, pages })),
  };
};

const previewWith = async (
  scan: SiteScan,
  answers: InitAnswers,
  configDir: string,
  log: Log,
) => {
  const config = parseConfig(
    proposeConfig(scan, answers, configDir).raw,
    configDir,
  );
  const preview = await previewIssuance(config);
  log.log(
    `CA を作れるページ ${preview.issuable}、作れないページ ${preview.problems.reduce((sum, { pages }) => sum + pages.length, 0)}、selector に当たらないページ ${preview.unmatched}`,
  );
  for (const { problem, pages } of preview.problems) {
    log.log(
      `  - ${problem}: ${pages.slice(0, 3).join(", ")}${pages.length > 3 ? ` ほか ${pages.length - 3}` : ""}`,
    );
  }
  return config;
};

const askAnswers = async (
  scan: SiteScan,
  given: InitAnswers,
  ask: Ask,
  configDir: string,
  log: Log,
): Promise<InitAnswers> => {
  const answers = { ...given };
  answers.issuer ??= await askValid(
    ask,
    log,
    "issuer（OP レジストリに登録した OP ID、dns: で始まる）",
    undefined,
    parseIssuer,
  );
  if (answers.origins === undefined) {
    for (const { origin, pages } of scan.origins) {
      log.log(`  ${origin}: ${pages} ページ（canonical / og:url）`);
    }
    answers.origins = await askValid(
      ask,
      log,
      "サイトのオリジン（カンマ区切り。http は localhost だけ）",
      scan.origins[0]?.origin,
      (value) => list(value).map(parseOrigin),
    );
  }
  if (answers.selector === undefined) {
    for (const { selector, pages } of scan.selectors) {
      log.log(`  ${selector}: ${pages} / ${scan.pages} ページ`);
    }
    answers.selector = await askValid(
      ask,
      log,
      "証明する要素の selector",
      suggestSelector(scan),
      (value) => {
        if (!value) {
          throw new Error("selector が必要です");
        }
        return value;
      },
    );
  }
  if (answers.author === undefined && scan.withoutAuthor > 0) {
    log.log(
      `  <meta name="author"> が無いページ: ${scan.withoutAuthor} / ${scan.pages}`,
    );
    answers.author = names(
      await ask(
        "author が無いページの著者（カンマ区切り。無ければ空のまま）",
        "",
      ),
    );
  }
  answers.editor ??= names(
    await ask(
      "編集者（カンマ区切り。無ければ空のまま）",
      answers.author?.join(", ") ?? "",
    ),
  );
  if (answers.genre === undefined && scan.withoutGenre > 0) {
    log.log(
      `  <meta property="article:section"> が無いページ: ${scan.withoutGenre} / ${scan.pages}`,
    );
    answers.genre = (
      await ask(
        "article:section が無いページのジャンル（無ければ空のまま）",
        "",
      )
    ).trim();
  }
  if (answers.exclude === undefined) {
    await previewWith(scan, answers, configDir, log);
    answers.exclude = await askValid(
      ask,
      log,
      "対象にしないパスの正規表現（カンマ区切り。無ければ空のまま）",
      "",
      (value) => list(value).map(parsePattern),
    );
  }
  answers.persistence ??= await askValid(
    ask,
    log,
    "CAS の置き場所。commit はリポジトリに置いてビルドに含める、rebuild はデプロイのたびに作り直す",
    "commit",
    parsePersistence,
  );
  if (answers.persistence === "commit" && answers.publicDir === undefined) {
    answers.publicDir = resolve(
      await askValid(
        ask,
        log,
        "CAS を置く静的ファイルのディレクトリ（ビルドで出力に写るところ）",
        shown(scan.publicDir ?? resolve(configDir, "public")),
        (value) => {
          if (!value) {
            throw new Error("ディレクトリが必要です");
          }
          return value;
        },
      ),
    );
  }
  return answers;
};

const nextSteps = (config: CaConfig, persistence: Persistence) => {
  const dist = relative(process.cwd(), config.distDir) || ".";
  const steps = [
    "次の手順:",
    "  環境変数 CA_SERVER_URL と CCSP_CONFIG を設定する",
    `  ビルドしてから ca inject ${dist} && ca sync ${dist}`,
  ];
  return persistence === "commit"
    ? [
        ...steps,
        `  ${relative(process.cwd(), config.publicDir)} に書かれた CAS をコミットする（${dist} にも写すので、そのままデプロイしてよい）`,
        "  以後はビルドのたびに同じ 2 コマンドを流す。変わったページだけ署名し直す",
      ]
    : [
        ...steps,
        `  ${dist} をデプロイする`,
        "  ⚠ CAS はビルドのたびに消えるので、デプロイごとに全ページを署名し直し、CA ID も変わる",
      ];
};

export const init = async (options: {
  configFile: string;
  answers: InitAnswers;
  force: boolean;
  ask?: Ask;
  log: Pick<Console, "log">;
}): Promise<CaConfig> => {
  const { log, ask } = options;
  const configFile = resolve(options.configFile);
  const configDir = dirname(configFile);
  const distDir =
    options.answers.distDir ??
    (ask
      ? await askDistDir(configDir, ask, log)
      : (await distCandidates(configDir))[0]?.dir);
  if (distDir === undefined) {
    throw new Error(
      `ビルド済み HTML が見つかりません。先にビルドするか --dist で指定してください（探した場所: ${DIST_CANDIDATES.join(", ")}）`,
    );
  }
  const scan = await scanSite(configDir, resolve(distDir));
  if (scan.pages === 0) {
    throw new Error(`${distDir} に HTML がありません`);
  }
  log.log(`${shown(scan.distDir)} の HTML ${scan.pages} ページを調べました`);
  const answers = ask
    ? await askAnswers(scan, options.answers, ask, configDir, log)
    : options.answers;
  const { raw, persistence } = proposeConfig(scan, answers, configDir);
  parseConfig(raw, configDir);
  if (!answers.author?.length && scan.withoutAuthor > 0) {
    log.log(
      `⚠ <meta name="author"> が無いページ ${scan.withoutAuthor} / ${scan.pages} の CA には author が入りません（--author で既定を渡せます）`,
    );
  }
  const json = `${JSON.stringify(raw, null, 2)}\n`;

  const current = existsSync(configFile)
    ? await readFile(configFile, "utf-8")
    : undefined;
  if (current === json) {
    log.log(`${relative(process.cwd(), configFile)} は変わりません`);
  } else {
    if (current !== undefined && !options.force) {
      throw new Error(
        [
          `${relative(process.cwd(), configFile)} がすでにあります。上書きするには --force を付けてください`,
          "--- 今の内容",
          current.trimEnd(),
          "+++ 作る内容",
          json.trimEnd(),
        ].join("\n"),
      );
    }
    await writeFile(configFile, json);
    log.log(`✓ ${relative(process.cwd(), configFile)} を書きました`);
  }

  const config = await previewWith(scan, answers, configDir, log);
  for (const line of nextSteps(config, persistence)) {
    log.log(line);
  }
  return config;
};
