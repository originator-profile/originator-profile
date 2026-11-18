import {
  AllowedUrl,
  type UnsignedContentAttestation,
} from "@originator-profile/model";
import type { JSDOM } from "jsdom";
import { dirname, relative, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { Recorded } from "../cas/source.ts";
import { DEFAULT_EXTERNAL_SELECTOR } from "../targets/html.ts";
import { readText } from "../utils/file.ts";
import { parseHtml } from "../utils/html.ts";
import type { CaConfig } from "./config.ts";

export type Page = { file: string; html: string; dom: JSDOM };

const withPage = async <T>(
  file: string,
  visit: (page: Page) => Promise<T> | T,
): Promise<T> => {
  const html = await readText(file);
  const dom = parseHtml(html);
  try {
    return await visit({ file, html, dom });
  } finally {
    dom.window.close();
  }
};

export const forEachPage = async (
  files: string[],
  visit: (page: Page) => Promise<void> | void,
): Promise<void> => {
  for (const file of files) {
    // oxlint-disable-next-line no-await-in-loop -- jsdom はページごとにメモリを大きく使うので、1 ページずつ開いて閉じる
    await withPage(file, visit);
  }
};

export class UnissuableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnissuableError";
  }
}

const attr = (document: Document, selector: string, name: string) =>
  document.querySelector(selector)?.getAttribute(name)?.trim() || undefined;

const meta = (document: Document, key: string) =>
  attr(document, `meta[property='${key}'], meta[name='${key}']`, "content");

const microdataText = (document: Document, prop: string) => {
  const element = document.querySelector(`[itemprop='${prop}']`);
  if (element === null) {
    return undefined;
  }
  return (
    element.getAttribute("content")?.trim() ||
    element.textContent?.trim() ||
    element.querySelector("[aria-label]")?.getAttribute("aria-label")?.trim() ||
    undefined
  );
};

const microdataDate = (document: Document, prop: string) => {
  const element = document.querySelector(`[itemprop='${prop}']`);
  return (
    element?.getAttribute("datetime")?.trim() ||
    element?.getAttribute("content")?.trim() ||
    undefined
  );
};

const DATE =
  /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(:\d{2}(?:\.\d+)?)?)?(Z|[+-]\d{2}:\d{2})?$/;

// Article の datePublished / dateModified は xsd:dateTimeStamp（秒とタイムゾーンが必須）。
const dateTimeStampOf = (name: string, value: string | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  const match = DATE.exec(value);
  if (match === null || (match[2] !== undefined && match[4] === undefined)) {
    throw new UnissuableError(
      `${name} must be a date, or a date-time with a time zone: ${value}`,
    );
  }
  const [, date, time = "00:00", seconds = ":00", zone = "Z"] = match;
  return `${date}T${time}${seconds}${zone}`;
};

export const pathnameOf = (distDir: string, htmlFile: string): string => {
  const rel = relative(distDir, htmlFile).split(sep).join("/");
  const path = rel.endsWith("index.html") ? dirname(rel) : rel;
  return path === "." ? "/" : `/${path}`;
};

export const pathToCasName = (pathname: string): string =>
  pathname.replace(/\/$/, "").replace(/^\//, "").replaceAll("/", ".");

export const isExcluded = (config: CaConfig, pathname: string): boolean =>
  config.excludeRe.some((pattern) => pattern.test(pathname));

export const selectorFor = (
  config: CaConfig,
  pathname: string,
  recorded: Recorded | undefined,
): string | undefined =>
  recorded?.selector ??
  config.selectors.find(
    (rule) =>
      rule.match === undefined || new RegExp(rule.match).test(pathname),
  )?.selector;

const escapePattern = (value: string) => value.replace(/[:*?+(){}\\]/g, "\\$&");

const allowedUrlOf = (
  config: CaConfig,
  document: Document,
  pathname: string,
): AllowedUrl => {
  const urls = config.origins?.length
    ? config.origins.map((origin) => `${origin.replace(/\/$/, "")}${pathname}`)
    : [
        attr(document, "link[rel='canonical']", "href") ??
          meta(document, "og:url") ??
          (() => {
            throw new UnissuableError(
              "no origins in the config, and no canonical link or og:url in the page",
            );
          })(),
      ];
  return AllowedUrl.parse(
    urls.map((url) => {
      const { origin, pathname: path } = new URL(url);
      return `${origin}${escapePattern(path.replace(/\/$/, ""))}(/?)`;
    }),
  );
};

const externalTargets = (config: CaConfig, document: Document) =>
  Array.from(
    document.querySelectorAll(
      config.externalSelector ?? DEFAULT_EXTERNAL_SELECTOR,
    ),
  ).flatMap((element) => {
    const integrity = element.getAttribute("integrity");
    return integrity
      ? [{ type: "ExternalResourceTargetIntegrity" as const, integrity }]
      : [];
  });

const SUBJECT_KEYS = [
  "type",
  "headline",
  "description",
  "author",
  "editor",
  "datePublished",
  "dateModified",
  "genre",
] as const;

export type MetadataField =
  | (typeof SUBJECT_KEYS)[number]
  | "image"
  | "allowedUrl";

// image は CA Server が digestSRI を足すので id だけを比べる。
export const metadataDiff = (
  uca: UnsignedContentAttestation,
  payload: Record<string, unknown>,
): MetadataField[] => {
  const signed = (payload.credentialSubject ?? {}) as Record<string, unknown>;
  const built = uca.credentialSubject as Record<string, unknown>;
  const imageId = (subject: Record<string, unknown>) =>
    (subject.image as { id?: unknown } | undefined)?.id;
  return [
    ...SUBJECT_KEYS.filter(
      (key) => !isDeepStrictEqual(built[key], signed[key]),
    ),
    ...(imageId(built) === imageId(signed) ? [] : ["image" as const]),
    ...(isDeepStrictEqual(uca.allowedUrl, payload.allowedUrl)
      ? []
      : ["allowedUrl" as const]),
  ];
};

const withoutUndefined = <T extends object>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;

const selectorOf = (input: {
  config: CaConfig;
  document: Document;
  pathname: string;
  recorded: Recorded | undefined;
  selector?: string;
}): string => {
  const selector =
    input.selector ?? selectorFor(input.config, input.pathname, input.recorded);
  if (selector === undefined) {
    throw new UnissuableError(`no selectors rule matches ${input.pathname}`);
  }
  if (input.document.querySelector(selector) === null) {
    throw new UnissuableError(`no element matches ${selector}`);
  }
  return selector;
};

const headlineOf = (document: Document) => {
  const headline =
    microdataText(document, "headline") ??
    meta(document, "og:title") ??
    (document.title.trim() || undefined);
  const description =
    meta(document, "og:description") ?? meta(document, "description");
  if (!headline || !description) {
    throw new UnissuableError(
      "og:title or <title>, and og:description or description are required",
    );
  }
  return { headline, description };
};

const datesOf = (document: Document) => ({
  datePublished: dateTimeStampOf(
    "datePublished",
    microdataDate(document, "datePublished") ??
      meta(document, "article:published_time"),
  ),
  dateModified: dateTimeStampOf(
    "dateModified",
    microdataDate(document, "dateModified") ??
      meta(document, "article:modified_time"),
  ),
});

const articleOf = (
  config: CaConfig,
  document: Document,
  recorded: Recorded | undefined,
) => {
  const { defaults } = config;
  const author = meta(document, "author");
  const image = meta(document, "og:image");
  return withoutUndefined({
    id: recorded?.id || undefined,
    type: "Article" as const,
    ...headlineOf(document),
    image: image && { id: image },
    author: author ? [author] : defaults.author,
    editor: defaults.editor,
    ...datesOf(document),
    genre: (meta(document, "article:section") ?? defaults.genre) || undefined,
  });
};

/**
 * 未署名 CA を組み立てる。
 * `contentPath` は target.content にそのまま書き、署名前に
 * `resolveTargetContent` で HTML へ展開する。
 */
export const buildUnsignedCa = (input: {
  config: CaConfig;
  document: Document;
  pathname: string;
  recorded: Recorded | undefined;
  selector?: string;
  /** HTML ファイルの相対パス（cwd 基準）。署名前に HTML へ展開する。 */
  contentPath: string;
}): UnsignedContentAttestation => {
  const { config, document, pathname, recorded, contentPath } = input;
  const selector = selectorOf(input);
  const language = document.documentElement.lang || undefined;

  return {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      ...(language ? [{ "@language": language }] : []),
    ],
    type: ["VerifiableCredential", "ContentAttestation"],
    issuer: config.issuer,
    credentialSubject: articleOf(config, document, recorded),
    allowedUrl: allowedUrlOf(config, document, pathname),
    target: [
      {
        type: "TextTargetIntegrity",
        cssSelector: selector,
        content: contentPath,
      },
      ...externalTargets(config, document),
    ],
  };
};
