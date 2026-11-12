import { JSDOM } from "jsdom";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { readCasFile } from "../cas-store/file.ts";
import { detectDrift, type DriftResult } from "../drift/compare.ts";
import type { CaConfig } from "./config.ts";
import { expiresAt, jwtPayload } from "./expiry.ts";
import { isInside } from "./paths.ts";

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

export type CasContext = Pick<
  CaConfig,
  "issuer" | "publicDir" | "distDir" | "origins"
>;

const contentOf = (source: InlineSource) =>
  source.html.slice(source.start, source.end);

export type Recorded = { id?: string; selector?: string };

export type Cas = {
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

export const labelOf = (source: CasSource): string =>
  source.kind === "file"
    ? relative(process.cwd(), source.path)
    : `${relative(process.cwd(), source.htmlFile)} (埋め込み)`;

type CasItem = string | { attestation: string; [key: string]: unknown };

const itemsOf = async (source: CasSource): Promise<CasItem[]> => {
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
  if (!Array.isArray(value)) {
    throw new Error(`${labelOf(source)} の CAS が配列ではありません`);
  }
  return value as CasItem[];
};

const jwtOf = (item: CasItem) =>
  typeof item === "string" ? item : item?.attestation;

const indexIn = (items: CasItem[], issuer: string) =>
  items.findIndex((item) => jwtPayload(jwtOf(item))?.issuer === issuer);

const ownIndex = async (source: CasSource, issuer: string) =>
  indexIn(await itemsOf(source), issuer);

const ownJwt = async (source: CasSource, issuer: string) => {
  const items = await itemsOf(source);
  const index = indexIn(items, issuer);
  return index < 0 ? undefined : jwtOf(items[index]);
};

export const ownCaSourceOf = async (
  dom: JSDOM,
  context: CasContext,
  htmlFile: string,
  html: string,
): Promise<CasSource | undefined> => {
  const sources = localCasSourcesOf(dom, context, htmlFile, html);
  for (const source of sources) {
    // oxlint-disable-next-line no-await-in-loop -- 自分の CA が見つかったら、後ろの CAS は読まない
    if ((await ownIndex(source, context.issuer)) >= 0) {
      return source;
    }
  }
  return sources[0];
};

export type Page = { file: string; html: string; dom: JSDOM };

export const withPage = async <T>(
  file: string,
  visit: (page: Page) => Promise<T> | T,
): Promise<T> => {
  const html = await readFile(file, "utf-8");
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
// readCasFile は CAS の先頭の CA しか読まないので、自分の CA だけの CAS を一時ファイルにして渡す。
const withOwnCasFile = async <T>(
  jwt: string,
  read: (filePath: string) => Promise<T>,
): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), "ca-own-"));
  try {
    const filePath = join(dir, "own.cas.json");
    await writeFile(filePath, JSON.stringify([jwt]));
    return await read(filePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

export const readCas = async (
  source: CasSource | undefined,
  issuer: string,
): Promise<Cas | undefined> => {
  const jwt = source && (await ownJwt(source, issuer));
  if (jwt === undefined) {
    return undefined;
  }
  const { payload } = await withOwnCasFile(jwt, readCasFile);
  return { jwt, payload, expiresAt: expiresAt(jwt) };
};

export const recordedOf = (payload: Record<string, unknown>): Recorded => {
  const subject = payload.credentialSubject as { id?: string } | undefined;
  const targets = payload.target as
    | Array<{ type?: string; cssSelector?: string }>
    | undefined;
  return {
    id: subject?.id,
    selector: targets?.find((target) => target.type === "TextTargetIntegrity")
      ?.cssSelector,
  };
};

export const readRecorded = async (
  source: CasSource | undefined,
  issuer: string,
): Promise<Recorded | undefined> => {
  const cas = await readCas(source, issuer);
  return cas && recordedOf(cas.payload);
};

export const driftOf = async (
  source: CasSource,
  pageHtml: string,
  issuer: string,
): Promise<DriftResult> => {
  const jwt = await ownJwt(source, issuer);
  if (jwt === undefined) {
    return { status: "cas_missing", casFilePath: labelOf(source) };
  }
  const html = source.kind === "inline" ? source.html : pageHtml;
  return withOwnCasFile(jwt, (filePath) => detectDrift({ html, filePath }));
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
  const items = await itemsOf(source);
  const index = indexIn(items, context.issuer);
  if (index < 0) {
    items.push(jwt);
  } else {
    const item = items[index];
    items[index] =
      typeof item === "string" ? jwt : { ...item, attestation: jwt };
  }
  if (source.kind === "file") {
    await Promise.all(
      copiesOf(source.path, context).map(async (path) => {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, `${JSON.stringify(items, null, 2)}\n`);
      }),
    );
    return source;
  }
  const content = JSON.stringify(items);
  const html = `${source.html.slice(0, source.start)}${content}${source.html.slice(source.end)}`;
  await writeFile(source.htmlFile, html);
  return { ...source, html, end: source.start + content.length };
};
