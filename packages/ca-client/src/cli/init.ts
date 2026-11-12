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
import { forEachPage, type Page } from "./source.ts";

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

type PageTraits = {
  origin?: string;
  selectors: string[];
  hasAuthor: boolean;
  hasGenre: boolean;
};

const traitsOf = (document: Document): PageTraits => {
  const url =
    document.querySelector("link[rel='canonical']")?.getAttribute("href") ??
    document.querySelector("meta[property='og:url']")?.getAttribute("content");
  return {
    origin: url && URL.canParse(url) ? new URL(url).origin : undefined,
    selectors: SELECTOR_CANDIDATES.filter(
      (selector) => document.querySelector(selector) !== null,
    ),
    hasAuthor: Boolean(
      document.querySelector("meta[name='author']")?.getAttribute("content"),
    ),
    hasGenre: Boolean(
      document
        .querySelector("meta[property='article:section']")
        ?.getAttribute("content"),
    ),
  };
};

export const scanSite = async (
  root: string,
  distDir: string,
): Promise<SiteScan> => {
  const files = await resolveFiles(distDir, [], ".html");
  const traits: PageTraits[] = [];
  await forEachPage(files, ({ dom }) => {
    traits.push(traitsOf(dom.window.document));
  });
  return {
    distDir,
    pages: files.length,
    origins: countBy(traits.flatMap(({ origin }) => origin ?? [])).map(
      ({ key, pages }) => ({ origin: key, pages }),
    ),
    selectors: SELECTOR_CANDIDATES.map((selector) => ({
      selector,
      pages: traits.filter((trait) => trait.selectors.includes(selector))
        .length,
    })),
    withoutAuthor: traits.filter(({ hasAuthor }) => !hasAuthor).length,
    withoutGenre: traits.filter(({ hasGenre }) => !hasGenre).length,
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

const requiredAnswers = (scan: SiteScan, answers: InitAnswers) => {
  const selector = answers.selector ?? suggestSelector(scan);
  const missing = [
    ...(answers.issuer ? [] : ["--issuer"]),
    ...(selector ? [] : ["--selector"]),
  ];
  if (missing.length > 0) {
    throw new Error(`${missing.join(" と ")} が必要です`);
  }
  return { issuer: answers.issuer, selector };
};

const defaultsOf = (answers: InitAnswers) => ({
  ...(answers.author?.length ? { author: answers.author } : {}),
  ...(answers.editor?.length ? { editor: answers.editor } : {}),
  ...(answers.genre ? { genre: answers.genre } : {}),
});

const publicDirOf = (
  scan: SiteScan,
  answers: InitAnswers,
  configDir: string,
): string =>
  answers.publicDir ?? scan.publicDir ?? resolve(configDir, "public");

export const proposeConfig = (
  scan: SiteScan,
  answers: InitAnswers,
  configDir: string,
): Proposal => {
  const { issuer, selector } = requiredAnswers(scan, answers);
  const persistence = answers.persistence ?? "commit";
  const at = (dir: string) => relative(configDir, dir) || ".";
  const origins =
    answers.origins ?? scan.origins.slice(0, 1).map(({ origin }) => origin);
  const defaults = defaultsOf(answers);
  return {
    persistence,
    raw: {
      issuer,
      distDir: at(scan.distDir),
      ...(persistence === "commit"
        ? { publicDir: at(publicDirOf(scan, answers, configDir)) }
        : {}),
      ...(origins.length > 0 ? { origins } : {}),
      selectors: [{ selector }],
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
  try {
    return parse(await ask(question, fallback));
  } catch (error) {
    log.log(`  ${error instanceof Error ? error.message : String(error)}`);
    return askValid(ask, log, question, fallback, parse);
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

const previewPage = (
  config: CaConfig,
  { file, html, dom }: Page,
): "issuable" | "unmatched" | { problem: string } => {
  const pathname = pathnameOf(config.distDir, file);
  const document = dom.window.document;
  const selector = selectorFor(config, pathname, undefined);
  if (selector === undefined || document.querySelector(selector) === null) {
    return "unmatched";
  }
  try {
    buildUnsignedCa({
      config,
      document,
      pathname,
      recorded: undefined,
      content: html,
    });
    return "issuable";
  } catch (error) {
    if (!(error instanceof UnissuableError)) {
      throw error;
    }
    return { problem: error.message };
  }
};

export const previewIssuance = async (
  config: CaConfig,
): Promise<IssuancePreview> => {
  const files = (await resolveFiles(config.distDir, [], ".html")).filter(
    (file) => !isExcluded(config, pathnameOf(config.distDir, file)),
  );
  let issuable = 0;
  let unmatched = 0;
  const problems = new Map<string, string[]>();
  await forEachPage(files, (page) => {
    const result = previewPage(config, page);
    if (result === "issuable") {
      issuable++;
    } else if (result === "unmatched") {
      unmatched++;
    } else {
      problems.set(result.problem, [
        ...(problems.get(result.problem) ?? []),
        pathnameOf(config.distDir, page.file),
      ]);
    }
  });
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

const askSite = async (
  scan: SiteScan,
  answers: InitAnswers,
  ask: Ask,
  log: Log,
): Promise<void> => {
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
};

const askMetadata = async (
  scan: SiteScan,
  answers: InitAnswers,
  ask: Ask,
  log: Log,
): Promise<void> => {
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
};

const askPublishing = async (
  scan: SiteScan,
  answers: InitAnswers,
  ask: Ask,
  configDir: string,
  log: Log,
): Promise<void> => {
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
};

const askAnswers = async (
  scan: SiteScan,
  given: InitAnswers,
  ask: Ask,
  configDir: string,
  log: Log,
): Promise<InitAnswers> => {
  const answers = { ...given };
  await askSite(scan, answers, ask, log);
  await askMetadata(scan, answers, ask, log);
  await askPublishing(scan, answers, ask, configDir, log);
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

type InitOptions = {
  configFile: string;
  answers: InitAnswers;
  force: boolean;
  ask?: Ask;
  log: Pick<Console, "log">;
};

const distDirOf = async (
  { answers, ask, log }: InitOptions,
  configDir: string,
): Promise<string> => {
  const distDir =
    answers.distDir ??
    (ask
      ? await askDistDir(configDir, ask, log)
      : (await distCandidates(configDir))[0]?.dir);
  if (distDir === undefined) {
    throw new Error(
      `ビルド済み HTML が見つかりません。先にビルドするか --dist で指定してください（探した場所: ${DIST_CANDIDATES.join(", ")}）`,
    );
  }
  return distDir;
};

const writeConfigFile = async (
  configFile: string,
  json: string,
  { force, log }: Pick<InitOptions, "force" | "log">,
): Promise<void> => {
  const current = existsSync(configFile)
    ? await readFile(configFile, "utf-8")
    : undefined;
  if (current === json) {
    log.log(`${relative(process.cwd(), configFile)} は変わりません`);
    return;
  }
  if (current !== undefined && !force) {
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
};

export const init = async (options: InitOptions): Promise<CaConfig> => {
  const { log, ask } = options;
  const configFile = resolve(options.configFile);
  const configDir = dirname(configFile);
  const distDir = await distDirOf(options, configDir);
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
  await writeConfigFile(
    configFile,
    `${JSON.stringify(raw, null, 2)}\n`,
    options,
  );

  const config = await previewWith(scan, answers, configDir, log);
  for (const line of nextSteps(config, persistence)) {
    log.log(line);
  }
  return config;
};
