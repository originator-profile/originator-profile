import { JSDOM } from "jsdom";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { isInside } from "../file-utils";
import {
  expiresAt,
  isCasItem,
  ownEntry,
  recordedOf,
  serializeCas,
  upsertOwnItem,
  type Cas,
  type Recorded,
} from "./cas";
import { targetDrift, type TargetDrift } from "./drift";
export const CAS_SCRIPT_TYPE = "application/ca-set+json";
export const DEPRECATED_CAS_SCRIPT_TYPE = "application/cas+json";
const CAS_SCRIPT_SELECTOR = [CAS_SCRIPT_TYPE, DEPRECATED_CAS_SCRIPT_TYPE]
  .map((type) => `script[type='${type}']`)
  .join(", ");

export type CasSource =
  | { kind: "file"; path: string }
  | {
      kind: "inline";
      htmlFile: string;
      html: string;
      start: number;
      end: number;
    };

type InlineSource = Extract<CasSource, { kind: "inline" }>;

export type CasContext = {
  issuer: string;
  publicDir: string;
  distDir: string;
  origins?: string[];
};

const contentOf = (source: InlineSource) =>
  source.html.slice(source.start, source.end);

export type OwnCa = {
  jwt: string;
  payload: Record<string, unknown>;
  expiresAt?: Date;
};

// 先頭の BOM は parse5 に文字として扱われ <head> が暗黙になるので、同じ長さの空白に替えて位置を保つ。
export const parseHtml = (html: string): JSDOM =>
  new JSDOM(html.replace(/^\uFEFF/, " "), { includeNodeLocations: true });

type Offsets = { startOffset: number; endOffset: number };
type ElementLocation = {
  startTag?: Offsets & { attrs?: Record<string, Offsets> };
  endTag?: Offsets;
};

// @types/jsdom は要素にも Location を返す型だが、実体は parse5 の ElementLocation。
export const elementLocation = (
  dom: JSDOM,
  element: Element,
): ElementLocation | undefined =>
  (dom.nodeLocation(element) as unknown as ElementLocation | null) ?? undefined;

const RELATIVE_BASE = "https://relative.invalid";

export const localPathOf = (
  src: string,
  origins: string[] = [],
  baseDir = "/",
) => {
  const dir = baseDir.endsWith("/") ? baseDir : `${baseDir}/`;
  const url = new URL(src, new URL(dir, RELATIVE_BASE));
  const local =
    url.origin === new URL(RELATIVE_BASE).origin ||
    origins.some((origin) => new URL(origin).origin === url.origin);
  return local ? url.pathname : undefined;
};

const sourceOf = (
  dom: JSDOM,
  context: CasContext,
  htmlFile: string,
  html: string,
  script: Element,
): CasSource | undefined => {
  const src = script.getAttribute("src")?.trim();
  if (src) {
    const path = localPathOf(src, context.origins);
    return path === undefined
      ? undefined
      : { kind: "file", path: join(context.publicDir, path) };
  }
  const location = elementLocation(dom, script);
  if (!location?.startTag || !location.endTag) {
    return undefined;
  }
  return {
    kind: "inline",
    htmlFile,
    html,
    start: location.startTag.endOffset,
    end: location.endTag.startOffset,
  };
};

export const localCasSourcesOf = (
  dom: JSDOM,
  context: CasContext,
  htmlFile: string,
  html: string,
): CasSource[] =>
  Array.from(dom.window.document.querySelectorAll(CAS_SCRIPT_SELECTOR)).flatMap(
    (script) => sourceOf(dom, context, htmlFile, html, script) ?? [],
  );

export const usesDeprecatedType = (dom: JSDOM): boolean =>
  dom.window.document.querySelector(
    `script[type='${DEPRECATED_CAS_SCRIPT_TYPE}']`,
  ) !== null;

export const ownCaSourceOf = async (
  dom: JSDOM,
  context: CasContext,
  htmlFile: string,
  html: string,
): Promise<CasSource | undefined> => {
  const sources = localCasSourcesOf(dom, context, htmlFile, html);
  for (const source of sources) {
    if (ownEntry(await itemsOf(source), context.issuer)) {
      return source;
    }
  }
  return sources[0];
};

export const loadSource = async (
  htmlFile: string,
  context: CasContext,
): Promise<CasSource | undefined> => {
  const html = await readFile(htmlFile, "utf-8");
  const dom = parseHtml(html);
  try {
    return await ownCaSourceOf(dom, context, htmlFile, html);
  } finally {
    dom.window.close();
  }
};

export const labelOf = (source: CasSource): string =>
  source.kind === "file"
    ? relative(process.cwd(), source.path)
    : `${relative(process.cwd(), source.htmlFile)} (埋め込み)`;

async function itemsOf(source: CasSource): Promise<Cas> {
  const content =
    source.kind === "inline"
      ? contentOf(source)
      : existsSync(source.path)
        ? await readFile(source.path, "utf-8")
        : "";
  if (content.trim() === "") {
    return [];
  }
  const value: unknown = JSON.parse(content);
  if (!Array.isArray(value) || !value.every(isCasItem)) {
    throw new Error(`${labelOf(source)} の CAS が配列ではありません`);
  }
  return value;
}

export const readCas = async (
  source: CasSource | undefined,
  issuer: string,
): Promise<OwnCa | undefined> => {
  const entry = source && ownEntry(await itemsOf(source), issuer);
  if (!entry) {
    return undefined;
  }
  return { ...entry, expiresAt: expiresAt(entry.jwt) };
};

export const readRecorded = async (
  source: CasSource | undefined,
  issuer: string,
): Promise<Recorded | undefined> => {
  const cas = await readCas(source, issuer);
  return cas && recordedOf(cas.payload);
};

export type SourceDrift = TargetDrift | { status: "cas_missing" };

export const driftOf = async (
  source: CasSource,
  pageHtml: string,
  issuer: string,
): Promise<SourceDrift> => {
  const entry = ownEntry(await itemsOf(source), issuer);
  if (entry === undefined) {
    return { status: "cas_missing" };
  }
  const html = source.kind === "inline" ? source.html : pageHtml;
  return targetDrift({ html, payload: entry.payload });
};

// publicDir の CAS はビルドで distDir に写るまで配信されないので、ビルド済みの distDir にも同じものを書く。
export const distCopyOf = (
  path: string,
  context: CasContext,
): string | undefined =>
  isInside(context.publicDir, path) &&
  context.distDir !== context.publicDir &&
  existsSync(context.distDir)
    ? join(context.distDir, relative(context.publicDir, path))
    : undefined;

const copiesOf = (path: string, context: CasContext) => {
  const copy = distCopyOf(path, context);
  return copy ? [path, copy] : [path];
};

export const upsertOwnCa = async (
  source: CasSource,
  jwt: string,
  context: CasContext,
): Promise<CasSource> => {
  const items = upsertOwnItem(await itemsOf(source), jwt, context.issuer);
  if (source.kind === "file") {
    const body = serializeCas(items);
    for (const path of copiesOf(source.path, context)) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
    }
    return source;
  }
  const content = JSON.stringify(items);
  const html = `${source.html.slice(0, source.start)}${content}${source.html.slice(source.end)}`;
  await writeFile(source.htmlFile, html);
  return { ...source, html, end: source.start + content.length };
};
