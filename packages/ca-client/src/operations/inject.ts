import type { JSDOM } from "jsdom";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import {
  CAS_SCRIPT_TYPE,
  localCasSourcesOf,
  localPathOf,
} from "../cas/source.ts";
import { DEFAULT_EXTERNAL_SELECTOR } from "../targets/html.ts";
import { writeText } from "../utils/file.ts";
import { elementLocation } from "../utils/html.ts";
import { isInside, resolveFiles } from "../utils/paths.ts";
import type { CaConfig } from "./config.ts";
import {
  forEachPage,
  isExcluded,
  pathnameOf,
  pathToCasName,
  selectorFor,
  type Page,
} from "./page.ts";

export type InjectReport = {
  injected: string[];
  integrity: string[];
  problems: { pathname: string; problem: string }[];
};

type HtmlEdit = { start: number; end: number; text: string };

const escapeAttr = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

export const casTagFor = (config: CaConfig, pathname: string): string =>
  config.cas.mode === "inline"
    ? `<script type="${CAS_SCRIPT_TYPE}">[]</script>`
    : `<script type="${CAS_SCRIPT_TYPE}" src="${escapeAttr(
        config.cas.path.replaceAll("{path}", pathToCasName(pathname)),
      )}"></script>`;

const insertionOffset = (dom: JSDOM): number | undefined => {
  const { head, body } = dom.window.document;
  const firstInBody = body.firstChild && dom.nodeLocation(body.firstChild);
  return (
    elementLocation(dom, head)?.endTag?.startOffset ??
    elementLocation(dom, body)?.startTag?.startOffset ??
    firstInBody?.startOffset
  );
};

const sha256 = async (file: string) =>
  `sha256-${createHash("sha256")
    .update(await readFile(file))
    .digest("base64")}`;

type StartTag = NonNullable<ReturnType<typeof elementLocation>>["startTag"];

const localFileOf = (
  config: CaConfig,
  baseDir: string,
  src: string | undefined,
): string | undefined => {
  const path = src && localPathOf(src, config.origins, baseDir);
  const file = path && join(config.distDir, decodeURIComponent(path));
  return file && isInside(config.distDir, file) ? file : undefined;
};

const integrityAttrEdit = (
  startTag: NonNullable<StartTag>,
  html: string,
  integrity: string,
): HtmlEdit => {
  const text = `integrity="${integrity}"`;
  const current = startTag.attrs?.integrity;
  if (current) {
    return { start: current.startOffset, end: current.endOffset, text };
  }
  const close = startTag.endOffset - 1;
  const at = html[close - 1] === "/" ? close - 1 : close;
  return { start: at, end: at, text: ` ${text}` };
};

const integrityEditOf = async (
  config: CaConfig,
  page: { dom: JSDOM; html: string; baseDir: string },
  element: Element,
): Promise<{ edit: HtmlEdit } | { problem: string } | undefined> => {
  const src = element.getAttribute("src")?.trim();
  const file = localFileOf(config, page.baseDir, src);
  if (file === undefined) {
    return { problem: `cannot compute integrity for src: ${src ?? "(none)"}` };
  }
  const integrity = await sha256(file).catch(() => undefined);
  if (integrity === undefined) {
    return { problem: `cannot compute integrity for src: ${src}` };
  }
  if (element.getAttribute("integrity") === integrity) {
    return undefined;
  }
  const startTag = elementLocation(page.dom, element)?.startTag;
  if (!startTag) {
    return { problem: `cannot locate the element: ${src}` };
  }
  return { edit: integrityAttrEdit(startTag, page.html, integrity) };
};

const integrityEdits = async (
  config: CaConfig,
  dom: JSDOM,
  html: string,
  htmlFile: string,
): Promise<{ edits: HtmlEdit[]; problems: string[] }> => {
  const pageDir = relative(config.distDir, dirname(htmlFile));
  const baseDir = `/${pageDir.split(sep).join("/")}`;
  const results = await Promise.all(
    Array.from(
      dom.window.document.querySelectorAll(
        config.externalSelector ?? DEFAULT_EXTERNAL_SELECTOR,
      ),
      (element) => integrityEditOf(config, { dom, html, baseDir }, element),
    ),
  );
  return {
    edits: results.flatMap((result) =>
      result && "edit" in result ? [result.edit] : [],
    ),
    problems: results.flatMap((result) =>
      result && "problem" in result ? [result.problem] : [],
    ),
  };
};

const applyEdits = (html: string, edits: HtmlEdit[]) =>
  [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce(
      (out, { start, end, text }) =>
        `${out.slice(0, start)}${text}${out.slice(end)}`,
      html,
    );

const injectPage = async (
  config: CaConfig,
  { file: htmlFile, html, dom }: Page,
  check: boolean,
  report: InjectReport,
): Promise<void> => {
  const pathname = pathnameOf(config.distDir, htmlFile);
  const selector = selectorFor(config, pathname, undefined);
  if (
    selector === undefined ||
    dom.window.document.querySelector(selector) === null
  ) {
    return;
  }
  const edits: HtmlEdit[] = [];
  if (localCasSourcesOf(dom, config, htmlFile, html).length === 0) {
    const offset = insertionOffset(dom);
    if (offset === undefined) {
      report.problems.push({
        pathname,
        problem: "no place to insert the CAS tag",
      });
    } else {
      edits.push({
        start: offset,
        end: offset,
        text: casTagFor(config, pathname),
      });
      report.injected.push(pathname);
    }
  }
  const external = await integrityEdits(config, dom, html, htmlFile);
  report.problems.push(
    ...external.problems.map((problem) => ({ pathname, problem })),
  );
  if (external.edits.length > 0) {
    report.integrity.push(pathname);
  }
  edits.push(...external.edits);
  if (edits.length > 0 && !check) {
    await writeText(htmlFile, applyEdits(html, edits));
  }
};

export type InjectOptions = {
  /** true なら HTML を書かず、足りないタグと古い integrity を返す。 */
  check: boolean;
  paths?: string[];
};

export const inject = async (
  config: CaConfig,
  options: InjectOptions,
): Promise<InjectReport> => {
  const report: InjectReport = { injected: [], integrity: [], problems: [] };
  const files = (
    await resolveFiles(config.distDir, options.paths ?? [], ".html")
  ).filter((file) => !isExcluded(config, pathnameOf(config.distDir, file)));
  await forEachPage(files, (page) =>
    injectPage(config, page, options.check, report),
  );
  return report;
};
