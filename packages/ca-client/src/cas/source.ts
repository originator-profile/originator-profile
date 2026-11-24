import type { JSDOM } from "jsdom";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { decodeCa, type DecodedCa } from "../ca/decode.ts";
import { jwtPayload } from "../ca/expiry.ts";
import { CaClientError, CaClientErrorCode } from "../errors.ts";
import { compareTargets, type TargetComparison } from "../targets/compare.ts";
import { isEnoent, readText, writeText } from "../utils/file.ts";
import { isInside } from "../utils/paths.ts";

export const CAS_SCRIPT_TYPE = "application/ca-set+json";
export const DEPRECATED_CAS_SCRIPT_TYPE = "application/cas+json";
/** `DEPRECATED_CAS_SCRIPT_TYPE` のサポート終了日（この日以降は対象外）。 */
export const DEPRECATED_CAS_SCRIPT_TYPE_UNTIL = "2027-11-01";
const CAS_SCRIPT_SELECTOR = [CAS_SCRIPT_TYPE, DEPRECATED_CAS_SCRIPT_TYPE]
  .map((type) => `script[type='${type}']`)
  .join(", ");

/** CAS ファイル。パスは絶対パス。 */
export type CasSource = { path: string };

export type CasContext = {
  issuer: string;
  publicDir: string;
  distDir: string;
  origins?: string[];
};

export type Recorded = { id?: string; selector?: string };

const RELATIVE_BASE = "https://relative.invalid";
const RELATIVE_ORIGIN = new URL(RELATIVE_BASE).origin;

export const localPathOf = (
  src: string,
  origins: string[] = [],
  baseDir = "/",
) => {
  const dir = baseDir.endsWith("/") ? baseDir : `${baseDir}/`;
  const url = new URL(src, new URL(dir, RELATIVE_BASE));
  const local =
    url.origin === RELATIVE_ORIGIN ||
    origins.some((origin) => new URL(origin).origin === url.origin);
  return local ? url.pathname : undefined;
};

const sourceOf = (
  context: CasContext,
  script: Element,
): CasSource | undefined => {
  const src = script.getAttribute("src")?.trim();
  if (!src) {
    return undefined;
  }
  const path = localPathOf(src, context.origins);
  return path === undefined
    ? undefined
    : { path: join(context.publicDir, path) };
};

export const localCasSourcesOf = (
  dom: JSDOM,
  context: CasContext,
  _htmlFile: string,
  _html: string,
): CasSource[] =>
  Array.from(dom.window.document.querySelectorAll(CAS_SCRIPT_SELECTOR)).flatMap(
    (script) => sourceOf(context, script) ?? [],
  );

export const usesDeprecatedType = (dom: JSDOM): boolean =>
  dom.window.document.querySelector(
    `script[type='${DEPRECATED_CAS_SCRIPT_TYPE}']`,
  ) !== null;

/** CAS の置き場所。パスは絶対パス。 */
export type CasLocation = { path: string };

export const locationOf = (source: CasSource): CasLocation => ({
  path: source.path,
});

export const whereOf = (location: CasLocation): string =>
  relative(process.cwd(), location.path);

const readFileCas = async (path: string): Promise<string> => {
  try {
    return await readText(path);
  } catch (error) {
    if (error instanceof CaClientError && isEnoent(error.cause)) {
      return "";
    }
    throw error;
  }
};

const itemsOf = async (source: CasSource): Promise<unknown[]> => {
  const content = await readFileCas(source.path);
  if (content.trim() === "") {
    return [];
  }
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch (error) {
    throw new CaClientError(`${whereOf(source)} is not valid JSON`, {
      code: CaClientErrorCode.Validation,
      cause: error,
    });
  }
  if (!Array.isArray(value)) {
    throw new CaClientError(`${whereOf(source)} is not a JSON array`, {
      code: CaClientErrorCode.Validation,
    });
  }
  // 要素の形（JWT 文字列 / { attestation }）は jwtOf で見る
  return value;
};

const jwtOf = (item: unknown): string | undefined => {
  if (typeof item === "string") {
    return item;
  }
  if (
    typeof item === "object" &&
    item !== null &&
    "attestation" in item &&
    typeof item.attestation === "string"
  ) {
    return item.attestation;
  }
  return undefined;
};

const indexIn = (items: unknown[], issuer: string) =>
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
  // まだ自分の CA が無いときは、書き込み先として先頭の CAS を使う
  return sources[0];
};

export const readCas = async (
  source: CasSource | undefined,
  issuer: string,
): Promise<DecodedCa | undefined> => {
  const jwt = source && (await ownJwt(source, issuer));
  return jwt === undefined ? undefined : decodeCa(jwt);
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
): Promise<TargetComparison | { status: "cas_missing" }> => {
  const jwt = await ownJwt(source, issuer);
  if (jwt === undefined) {
    return { status: "cas_missing" };
  }
  return compareTargets({ html: pageHtml, jwt });
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
      typeof item === "string" || item === null || typeof item !== "object"
        ? jwt
        : { ...item, attestation: jwt };
  }
  await Promise.all(
    copiesOf(source.path, context).map((path) =>
      writeText(path, `${JSON.stringify(items, null, 2)}\n`),
    ),
  );
  return source;
};
