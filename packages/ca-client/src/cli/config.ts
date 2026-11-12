import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type SelectorRule = { match?: string; selector: string };

export type CasMode = "file" | "inline";

export type CaConfig = {
  issuer: string;
  distDir: string;
  publicDir: string;
  origins?: string[];
  selectors: SelectorRule[];
  exclude?: string[];
  externalSelector?: string;
  defaults?: { author?: string[]; editor?: string[]; genre?: string };
  renewWithinDays: number;
  cas: { mode: CasMode; path: string };
};

const DEFAULT_RENEW_WITHIN_DAYS = 30;
const DEFAULT_CAS_PATH = "/cas/{path}.cas.json";

const fail = (message: string): never => {
  throw new Error(`ca config: ${message}`);
};

const strings = (value: unknown, key: string): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return fail(`${key} は文字列の配列`);
  }
  return value;
};

const LOCALHOSTS = ["localhost", "127.0.0.1", "[::1]"];

export const parseOrigin = (value: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(`origins の ${value} は URL ではない`);
  }
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && LOCALHOSTS.includes(url.hostname))
  ) {
    fail(`origins の ${value} は https（http は localhost だけ）`);
  }
  if (`${url.origin}/` !== url.href.replace(/\/?$/, "/")) {
    fail(`origins の ${value} はパスを含まないオリジン`);
  }
  return url.origin;
};

export const parseIssuer = (value: string): string =>
  value.startsWith("dns:")
    ? value
    : fail(`issuer は dns: で始まる OP ID: ${value}`);

export const parsePattern = (value: string): string => {
  try {
    new RegExp(value);
  } catch {
    fail(`exclude の ${value} は正規表現ではない`);
  }
  return value;
};

export const parseConfig = (raw: unknown, baseDir: string): CaConfig => {
  const value = (raw ?? {}) as Record<string, unknown>;
  const text = (key: string, fallback?: string): string => {
    const item = value[key] ?? fallback;
    return typeof item === "string" && item !== ""
      ? item
      : fail(`${key} は必須の文字列`);
  };
  const issuer = parseIssuer(text("issuer"));
  const selectors = value.selectors;
  if (
    !Array.isArray(selectors) ||
    selectors.length === 0 ||
    selectors.some(
      (rule) =>
        typeof rule?.selector !== "string" ||
        (rule.match !== undefined && typeof rule.match !== "string"),
    )
  ) {
    fail("selectors は { match?, selector } の配列");
  }
  const defaults = (value.defaults ?? {}) as Record<string, unknown>;
  if (defaults.genre !== undefined && typeof defaults.genre !== "string") {
    fail("defaults.genre は文字列");
  }
  const renewWithinDays = value.renewWithinDays ?? DEFAULT_RENEW_WITHIN_DAYS;
  if (
    typeof renewWithinDays !== "number" ||
    !Number.isFinite(renewWithinDays) ||
    renewWithinDays < 0
  ) {
    fail("renewWithinDays は 0 以上の数");
  }
  const cas = (value.cas ?? {}) as Record<string, unknown>;
  const mode = cas.mode ?? "file";
  if (mode !== "file" && mode !== "inline") {
    fail('cas.mode は "file" か "inline"');
  }
  const casPath = cas.path ?? DEFAULT_CAS_PATH;
  if (typeof casPath !== "string" || !casPath.includes("{path}")) {
    fail("cas.path は {path} を含む文字列");
  }
  return {
    issuer,
    distDir: resolve(baseDir, text("distDir", "dist")),
    publicDir: resolve(baseDir, text("publicDir", "public")),
    origins: strings(value.origins, "origins")?.map(parseOrigin),
    selectors: selectors as SelectorRule[],
    exclude: strings(value.exclude, "exclude")?.map(parsePattern),
    externalSelector:
      typeof value.externalSelector === "string"
        ? value.externalSelector
        : undefined,
    defaults: {
      author: strings(defaults.author, "defaults.author"),
      editor: strings(defaults.editor, "defaults.editor"),
      genre: defaults.genre as string | undefined,
    },
    renewWithinDays: renewWithinDays as number,
    cas: { mode: mode as CasMode, path: casPath as string },
  };
};

export const loadConfig = async (file: string): Promise<CaConfig> => {
  const path = resolve(file);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, "utf-8"));
  } catch (error) {
    throw new Error(`ca config: ${path} を読めません`, { cause: error });
  }
  return parseConfig(raw, dirname(path));
};
