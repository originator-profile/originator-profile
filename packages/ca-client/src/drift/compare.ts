import { readFile } from "node:fs/promises";
import { decodeJwtPayload } from "../auth/jwt";
import { parseCasFileContent, resolveCasFilePath } from "../cas-store/file";
import { isEnoent, toFileError } from "../file-utils";
import { isRecord } from "../is-record";
import {
  DEFAULT_EXTERNAL_SELECTOR,
  extractTargetsFromHtml,
  type ExtractTargetsOptions,
} from "../targets/html";

export type NormalizedTarget = {
  type: string;
  integrity: string;
  cssSelector?: string;
};

export type DriftResult =
  | { status: "ok"; casFilePath: string }
  | { status: "cas_missing"; casFilePath: string }
  | { status: "cas_invalid"; casFilePath: string; reason: string }
  | { status: "html_no_targets"; casFilePath: string }
  | {
      status: "drifted";
      casFilePath: string;
      current: NormalizedTarget[];
      expected: NormalizedTarget[];
    };

export type DetectDriftOptions = {
  /** Built HTML to recompute target integrity from. */
  html: string;
  /**
   * Path to the CAS file, e.g. `dist/cas/ja-JP.page.cas.json`.
   * Relative paths resolve against the current working directory.
   */
  filePath: string;
  /** CSS selector for TextTargetIntegrity when CAS has none. */
  textSelector?: string;
  /** CSS selector for HtmlTargetIntegrity when CAS has none. */
  htmlSelector?: string;
  /** CSS selector for VisibleTextTargetIntegrity when CAS has none. */
  visibleTextSelector?: string;
  /**
   * CSS selector for ExternalResourceTargetIntegrity elements.
   * Defaults to the CAS `cssSelector`, then `.target-integrity`.
   */
  externalSelector?: string;
};

type CasTarget = {
  type: string;
  cssSelector?: string;
  integrity: string;
};

const isCasTarget = (value: unknown): value is CasTarget =>
  isRecord(value) &&
  typeof value.type === "string" &&
  typeof value.integrity === "string";

const normalizeTargets = (targets: unknown): NormalizedTarget[] => {
  if (!Array.isArray(targets)) {
    return [];
  }

  return targets
    .filter(isCasTarget)
    .map((target) =>
      typeof target.cssSelector === "string"
        ? {
            type: target.type,
            integrity: target.integrity,
            cssSelector: target.cssSelector,
          }
        : { type: target.type, integrity: target.integrity },
    )
    .sort((a, b) => {
      // NUL separates fields so CSS selectors containing ":"
      // (e.g. :nth-child, :not) cannot collide with adjacent fields.
      const left = `${a.type}\0${a.cssSelector ?? ""}\0${a.integrity}`;
      const right = `${b.type}\0${b.cssSelector ?? ""}\0${b.integrity}`;
      return left.localeCompare(right);
    });
};

const areTargetsEqual = (
  currentTargets: NormalizedTarget[],
  casTargets: NormalizedTarget[],
): boolean => {
  if (currentTargets.length !== casTargets.length) {
    return false;
  }

  return currentTargets.every((target, index) => {
    const casTarget = casTargets[index];
    // Skip cssSelector when CAS omits it (ExternalResourceTargetIntegrity or
    // fallback selectors). Current targets may still have cssSelector.
    const cssSelectorEqual =
      casTarget?.cssSelector === undefined ||
      target.cssSelector === casTarget.cssSelector;
    return (
      target.type === casTarget?.type &&
      target.integrity === casTarget?.integrity &&
      cssSelectorEqual
    );
  });
};

type ReadCasTargetsResult =
  | { ok: true; targets: NormalizedTarget[] }
  | { ok: false; reason: string };

const parseCasTargets = (casFileContent: string): ReadCasTargetsResult => {
  let jwt: string;
  try {
    jwt = parseCasFileContent(casFileContent);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: detail };
  }

  try {
    const payload = decodeJwtPayload(jwt);
    return { ok: true, targets: normalizeTargets(payload.target) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: detail };
  }
};

const selectorsForType = (
  casTargets: NormalizedTarget[],
  type: string,
  fallback?: string,
): string[] => {
  const fromCas = [
    ...new Set(
      casTargets.flatMap((target) =>
        target.type === type && typeof target.cssSelector === "string"
          ? [target.cssSelector]
          : [],
      ),
    ),
  ];
  if (fromCas.length > 0) {
    return fromCas;
  }
  return fallback && fallback.length > 0 ? [fallback] : [];
};

const extractOptionsFromCas = (
  casTargets: NormalizedTarget[],
  options: DetectDriftOptions,
): ExtractTargetsOptions => ({
  textSelectors: selectorsForType(
    casTargets,
    "TextTargetIntegrity",
    options.textSelector,
  ),
  htmlSelectors: selectorsForType(
    casTargets,
    "HtmlTargetIntegrity",
    options.htmlSelector,
  ),
  visibleTextSelectors: selectorsForType(
    casTargets,
    "VisibleTextTargetIntegrity",
    options.visibleTextSelector,
  ),
  externalSelectors: selectorsForType(
    casTargets,
    "ExternalResourceTargetIntegrity",
    options.externalSelector ?? DEFAULT_EXTERNAL_SELECTOR,
  ),
});

export const detectDrift = async (
  options: DetectDriftOptions,
): Promise<DriftResult> => {
  const dest = resolveCasFilePath(options.filePath);

  let casFileContent: string;
  try {
    casFileContent = await readFile(dest, "utf8");
  } catch (error) {
    if (isEnoent(error)) {
      return { status: "cas_missing", casFilePath: dest };
    }
    throw toFileError(`Failed to read CAS file ${dest}`, error);
  }

  const casRead = parseCasTargets(casFileContent);
  if (!casRead.ok) {
    return { status: "cas_invalid", casFilePath: dest, reason: casRead.reason };
  }

  const casTargets = casRead.targets;
  const currentTargets = normalizeTargets(
    await extractTargetsFromHtml(
      options.html,
      extractOptionsFromCas(casTargets, options),
    ),
  );

  if (currentTargets.length === 0) {
    return { status: "html_no_targets", casFilePath: dest };
  }

  if (!areTargetsEqual(currentTargets, casTargets)) {
    return {
      status: "drifted",
      casFilePath: dest,
      current: currentTargets,
      expected: casTargets,
    };
  }

  return { status: "ok", casFilePath: dest };
};
