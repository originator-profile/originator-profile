import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CaClientError, CaClientErrorCode } from "../errors.ts";
import { toFileError } from "../utils/file.ts";

export type SelectorRule = {
  match?: string;
  selector: string;
  /** `parseCaConfig` が `match` から作る。 */
  matchRe?: RegExp;
};

export type CasMode = "file" | "inline";

export type CaConfig = {
  issuer: string;
  distDir: string;
  publicDir: string;
  origins?: string[];
  selectors: SelectorRule[];
  exclude?: string[];
  /** `parseCaConfig` が `exclude` から作る。 */
  excludeRe: RegExp[];
  externalSelector?: string;
  defaults: { author?: string[]; editor?: string[]; genre?: string };
  renewWithinDays: number;
  cas: { mode: CasMode; path: string };
};

const DEFAULT_RENEW_WITHIN_DAYS = 30;
const DEFAULT_CAS_PATH = "/cas/{path}.cas.json";

const fail = (message: string): never => {
  throw new CaClientError(`ca config: ${message}`, {
    code: CaClientErrorCode.Config,
  });
};

const strings = (value: unknown, key: string): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return fail(`${key} must be an array of strings`);
  }
  return value;
};

const LOCALHOSTS = ["localhost", "127.0.0.1", "[::1]"];

export const parseOrigin = (value: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(`origins: ${value} is not a URL`);
  }
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && LOCALHOSTS.includes(url.hostname))
  ) {
    fail(
      `origins: ${value} must use https (http is allowed only for localhost)`,
    );
  }
  if (`${url.origin}/` !== url.href.replace(/\/?$/, "/")) {
    fail(`origins: ${value} must be an origin without a path`);
  }
  return url.origin;
};

export const parseIssuer = (value: string): string =>
  value.startsWith("dns:")
    ? value
    : fail(`issuer must be an OP ID starting with "dns:" (got ${value})`);

export const parsePattern = (value: string, key = "exclude"): string => {
  try {
    new RegExp(value);
  } catch {
    fail(`${key}: ${value} is not a regular expression`);
  }
  return value;
};

const parseSelectors = (value: unknown): SelectorRule[] => {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (rule) =>
        typeof rule?.selector !== "string" ||
        (rule.match !== undefined && typeof rule.match !== "string"),
    )
  ) {
    fail("selectors must be a non-empty array of { match?, selector }");
  }
  return (value as { match?: string; selector: string }[]).map((rule) => ({
    selector: rule.selector,
    ...(rule.match !== undefined
      ? {
          match: parsePattern(rule.match, "selectors.match"),
          matchRe: new RegExp(rule.match),
        }
      : {}),
  }));
};

const parseRenewWithinDays = (value: unknown): number => {
  const days = value ?? DEFAULT_RENEW_WITHIN_DAYS;
  if (typeof days !== "number" || !Number.isFinite(days) || days < 0) {
    fail("renewWithinDays must be a number of 0 or more");
  }
  return days as number;
};

const parseCas = (value: unknown): CaConfig["cas"] => {
  const cas = (value ?? {}) as Record<string, unknown>;
  const mode = cas.mode ?? "file";
  if (mode !== "file" && mode !== "inline") {
    fail('cas.mode must be "file" or "inline"');
  }
  const path = cas.path ?? DEFAULT_CAS_PATH;
  if (typeof path !== "string" || !path.includes("{path}")) {
    fail("cas.path must be a string containing {path}");
  }
  return { mode: mode as CasMode, path: path as string };
};

export const parseCaConfig = (raw: unknown, baseDir: string): CaConfig => {
  const value = (raw ?? {}) as Record<string, unknown>;
  const text = (key: string, fallback?: string): string => {
    const item = value[key] ?? fallback;
    return typeof item === "string" && item !== ""
      ? item
      : fail(`${key} is required and must be a string`);
  };
  const issuer = parseIssuer(text("issuer"));
  const selectors = parseSelectors(value.selectors);
  const defaults = (value.defaults ?? {}) as Record<string, unknown>;
  if (defaults.genre !== undefined && typeof defaults.genre !== "string") {
    fail("defaults.genre must be a string");
  }
  const renewWithinDays = parseRenewWithinDays(value.renewWithinDays);
  const cas = parseCas(value.cas);
  const exclude = strings(value.exclude, "exclude")?.map((pattern) =>
    parsePattern(pattern),
  );
  return {
    issuer,
    distDir: resolve(baseDir, text("distDir", "dist")),
    publicDir: resolve(baseDir, text("publicDir", "public")),
    origins: strings(value.origins, "origins")?.map(parseOrigin),
    selectors,
    exclude,
    excludeRe: (exclude ?? []).map((pattern) => new RegExp(pattern)),
    externalSelector:
      typeof value.externalSelector === "string"
        ? value.externalSelector
        : undefined,
    defaults: {
      author: strings(defaults.author, "defaults.author"),
      editor: strings(defaults.editor, "defaults.editor"),
      genre: defaults.genre as string | undefined,
    },
    renewWithinDays,
    cas,
  };
};

export const loadCaConfig = async (file: string): Promise<CaConfig> => {
  const path = resolve(file);
  let content: string;
  try {
    content = await readFile(path, "utf-8");
  } catch (error) {
    throw toFileError(`Failed to read ca config ${path}`, error);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (error) {
    throw new CaClientError(`ca config: ${path} is not valid JSON`, {
      code: CaClientErrorCode.Config,
      cause: error,
    });
  }
  return parseCaConfig(raw, dirname(path));
};
