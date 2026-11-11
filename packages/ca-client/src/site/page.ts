import {
  AllowedUrl,
  type UnsignedContentAttestation,
} from "@originator-profile/model";
import { dirname, relative, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { Recorded } from "../cas/cas";
import type { CaConfig } from "./config";

export const DEFAULT_EXTERNAL_SELECTOR = ".target-integrity";

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
  return (
    element?.getAttribute("content")?.trim() ||
    element?.textContent?.trim() ||
    element
      ?.querySelector("[aria-label]")
      ?.getAttribute("aria-label")
      ?.trim() ||
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
      `${name} はタイムゾーン付きの日時か日付にしてください: ${value}`,
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
  (config.exclude ?? []).some((pattern) => new RegExp(pattern).test(pathname));

export const selectorFor = (
  config: CaConfig,
  pathname: string,
  recorded: Recorded | undefined,
): string | undefined =>
  recorded?.selector ??
  config.selectors.find(
    (rule) => rule.match === undefined || new RegExp(rule.match).test(pathname),
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
              "origins の設定も canonical も og:url もありません",
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

export const buildUnsignedCa = (input: {
  config: CaConfig;
  document: Document;
  pathname: string;
  recorded: Recorded | undefined;
  selector?: string;
  content: string;
}): UnsignedContentAttestation => {
  const { config, document, pathname, recorded, content } = input;
  const selector = input.selector ?? selectorFor(config, pathname, recorded);
  if (selector === undefined) {
    throw new UnissuableError(`${pathname} に合う selectors がありません`);
  }
  if (document.querySelector(selector) === null) {
    throw new UnissuableError(`${selector} に一致する要素がありません`);
  }
  const headline =
    microdataText(document, "headline") ??
    meta(document, "og:title") ??
    (document.title.trim() || undefined);
  const description =
    meta(document, "og:description") ?? meta(document, "description");
  if (!headline || !description) {
    throw new UnissuableError(
      "og:title か <title>、og:description か description が必要です",
    );
  }
  const language = document.documentElement.lang || undefined;
  const author = meta(document, "author");
  const image = meta(document, "og:image");
  const datePublished = dateTimeStampOf(
    "datePublished",
    microdataDate(document, "datePublished") ??
      meta(document, "article:published_time"),
  );
  const dateModified = dateTimeStampOf(
    "dateModified",
    microdataDate(document, "dateModified") ??
      meta(document, "article:modified_time"),
  );
  const defaults = config.defaults ?? {};

  return {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      ...(language ? [{ "@language": language }] : []),
    ],
    type: ["VerifiableCredential", "ContentAttestation"],
    issuer: config.issuer,
    credentialSubject: {
      ...(recorded?.id ? { id: recorded.id } : {}),
      type: "Article",
      headline,
      description,
      ...(image ? { image: { id: image } } : {}),
      ...(author
        ? { author: [author] }
        : defaults.author
          ? { author: defaults.author }
          : {}),
      ...(defaults.editor ? { editor: defaults.editor } : {}),
      ...(datePublished ? { datePublished } : {}),
      ...(dateModified ? { dateModified } : {}),
      ...((meta(document, "article:section") ?? defaults.genre)
        ? { genre: meta(document, "article:section") ?? defaults.genre }
        : {}),
    },
    allowedUrl: allowedUrlOf(config, document, pathname),
    target: [
      { type: "TextTargetIntegrity", cssSelector: selector, content },
      ...externalTargets(config, document),
    ],
  };
};
