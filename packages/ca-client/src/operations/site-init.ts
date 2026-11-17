import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { resolveFiles } from "../utils/paths.ts";
import { type CaConfig, type CasMode } from "./config.ts";
import {
  buildUnsignedCa,
  forEachPage,
  isExcluded,
  pathnameOf,
  selectorFor,
  UnissuableError,
  type Page,
} from "./page.ts";

export const CAS_MODES: CasMode[] = ["file", "inline"];

export const DIST_CANDIDATES = [
  "dist",
  "docs",
  "out",
  "build",
  "_site",
  "public",
];
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
  mode?: CasMode;
  publicDir?: string;
};

export type Proposal = {
  raw: Record<string, unknown>;
  mode: CasMode;
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

const requiredAnswers = (
  scan: SiteScan,
  answers: InitAnswers,
): { issuer: string; selector: string } => {
  const selector = answers.selector ?? suggestSelector(scan);
  const missing = [
    ...(answers.issuer ? [] : ["--issuer"]),
    ...(selector ? [] : ["--selector"]),
  ];
  if (missing.length > 0) {
    throw new Error(`${missing.join(" と ")} が必要です`);
  }
  // missing が空なら issuer / selector はどちらも入っている
  return { issuer: answers.issuer as string, selector: selector as string };
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
  const mode = answers.mode ?? "file";
  const at = (dir: string) => relative(configDir, dir) || ".";
  const origins =
    answers.origins ?? scan.origins.slice(0, 1).map(({ origin }) => origin);
  const defaults = defaultsOf(answers);
  return {
    mode,
    raw: {
      issuer,
      distDir: at(scan.distDir),
      ...(mode === "file"
        ? { publicDir: at(publicDirOf(scan, answers, configDir)) }
        : {}),
      ...(origins.length > 0 ? { origins } : {}),
      selectors: [{ selector }],
      ...(answers.exclude?.length ? { exclude: answers.exclude } : {}),
      ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
      cas: { mode },
    },
  };
};

export const parseCasMode = (value: string): CasMode => {
  if (!CAS_MODES.includes(value as CasMode)) {
    throw new Error(`--mode は ${CAS_MODES.join(" か ")}: ${value}`);
  }
  return value as CasMode;
};

export type IssuancePreview = {
  issuable: number;
  unmatched: number;
  problems: { problem: string; pages: string[] }[];
};

const previewPage = (
  config: CaConfig,
  { file, dom }: Page,
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
      contentPath: relative(process.cwd(), file),
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
