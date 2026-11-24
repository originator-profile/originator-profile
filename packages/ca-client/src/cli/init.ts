import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { CaClientError } from "../errors.ts";
import {
  parseCaConfig,
  parseIssuer,
  parseOrigin,
  type CaConfig,
} from "../operations/config.ts";
import {
  DIST_CANDIDATES,
  distCandidates,
  previewIssuance,
  proposeConfig,
  scanSite,
  suggestSelector,
  type InitAnswers,
  type SiteScan,
} from "../operations/site-init.ts";
import { isEnoent, readText, writeText } from "../utils/file.ts";

export type { InitAnswers, SiteScan } from "../operations/site-init.ts";

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
      // oxlint-disable-next-line no-await-in-loop -- 不正な答えのときだけ聞き直す
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

const previewWith = async (config: CaConfig, log: Log) => {
  const preview = await previewIssuance(config);
  log.log(
    `CA を作れるページ ${preview.issuable}、作れないページ ${preview.problems.reduce((sum, { pages }) => sum + pages.length, 0)}、セレクタに当たらないページ ${preview.unmatched}`,
  );
  for (const { problem, pages } of preview.problems) {
    log.log(
      `  - ${problem}: ${pages.slice(0, 3).join(", ")}${pages.length > 3 ? ` ほか ${pages.length - 3}` : ""}`,
    );
  }
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
    "発行者 ID（OP レジストリの dns: で始まる ID）",
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
      "サイトの URL（カンマ区切り。例: https://example.com。http は localhost だけ）",
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
      "証明する要素の CSS セレクタ",
      suggestSelector(scan),
      (value) => {
        if (!value) {
          throw new Error("CSS セレクタが必要です");
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
  // exclude は対話では聞かず、空配列のまま書いて後から編集してもらう
  answers.exclude ??= [];
  if (answers.publicDir === undefined) {
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

const nextSteps = (config: CaConfig) => {
  const dist = relative(process.cwd(), config.distDir) || ".";
  return [
    "次の手順:",
    "  環境変数 CA_SERVER_URL と CCSP_CONFIG を設定する",
    "  ビルドしてから opca inject && opca sync",
    `  ${relative(process.cwd(), config.publicDir)} に書かれた CAS をコミットする（${dist} にも写すので、そのままデプロイしてよい）`,
    "  以後はビルドのたびに同じ 2 コマンドを流す。変わったページだけ署名し直す",
  ];
};

export type InitOptions = {
  configFile: string;
  answers: InitAnswers;
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
  { log }: Pick<InitOptions, "log">,
): Promise<void> => {
  let current: string | undefined;
  try {
    current = await readText(configFile);
  } catch (error) {
    if (!(error instanceof CaClientError && isEnoent(error.cause))) {
      throw error;
    }
  }
  if (current === json) {
    log.log(`${relative(process.cwd(), configFile)} は変わりません`);
    return;
  }
  await writeText(configFile, json);
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
  const { raw } = proposeConfig(scan, answers, configDir);
  const config = parseCaConfig(raw, configDir);
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

  await previewWith(config, log);
  for (const line of nextSteps(config)) {
    log.log(line);
  }
  return config;
};
