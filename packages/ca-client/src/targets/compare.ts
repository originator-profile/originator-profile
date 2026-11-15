import { decodeCa } from "../ca/decode.ts";
import { isRecord } from "../utils/is-record.ts";
import {
  DEFAULT_EXTERNAL_SELECTOR,
  extractTargetsFromHtml,
  type ExtractTargetsOptions,
} from "./html.ts";

export type NormalizedTarget = {
  type: string;
  integrity: string;
  cssSelector?: string;
};

export type TargetComparison =
  | { status: "ok" }
  | { status: "html_no_targets" }
  | {
      status: "drifted";
      current: NormalizedTarget[];
      expected: NormalizedTarget[];
    };

export type CompareTargetsOptions = {
  /** Built HTML to recompute target integrity from. */
  html: string;
  /** Signed CA JWT whose `target` is compared with the HTML. */
  jwt: string;
  /** CSS selector for TextTargetIntegrity when the CA has none. */
  textSelector?: string;
  /** CSS selector for HtmlTargetIntegrity when the CA has none. */
  htmlSelector?: string;
  /** CSS selector for VisibleTextTargetIntegrity when the CA has none. */
  visibleTextSelector?: string;
  /**
   * CSS selector for ExternalResourceTargetIntegrity elements.
   * Defaults to the CA `cssSelector`, then `.target-integrity`.
   */
  externalSelector?: string;
};

type CaTarget = {
  type: string;
  cssSelector?: string;
  integrity: string;
};

const isCaTarget = (value: unknown): value is CaTarget =>
  isRecord(value) &&
  typeof value.type === "string" &&
  typeof value.integrity === "string";

const normalizeTargets = (targets: unknown): NormalizedTarget[] => {
  if (!Array.isArray(targets)) {
    return [];
  }

  return targets
    .filter(isCaTarget)
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
  caTargets: NormalizedTarget[],
): boolean => {
  if (currentTargets.length !== caTargets.length) {
    return false;
  }

  return currentTargets.every((target, index) => {
    const caTarget = caTargets[index];
    const cssSelectorMatchesOrUnrecorded =
      caTarget?.cssSelector === undefined ||
      target.cssSelector === caTarget.cssSelector;
    return (
      target.type === caTarget?.type &&
      target.integrity === caTarget?.integrity &&
      cssSelectorMatchesOrUnrecorded
    );
  });
};

const selectorsForType = (
  caTargets: NormalizedTarget[],
  type: string,
  fallback?: string,
): string[] => {
  const fromCa = [
    ...new Set(
      caTargets.flatMap((target) =>
        target.type === type && typeof target.cssSelector === "string"
          ? [target.cssSelector]
          : [],
      ),
    ),
  ];
  if (fromCa.length > 0) {
    return fromCa;
  }
  return fallback && fallback.length > 0 ? [fallback] : [];
};

const extractOptionsFromCa = (
  caTargets: NormalizedTarget[],
  options: CompareTargetsOptions,
): ExtractTargetsOptions => ({
  textSelectors: selectorsForType(
    caTargets,
    "TextTargetIntegrity",
    options.textSelector,
  ),
  htmlSelectors: selectorsForType(
    caTargets,
    "HtmlTargetIntegrity",
    options.htmlSelector,
  ),
  visibleTextSelectors: selectorsForType(
    caTargets,
    "VisibleTextTargetIntegrity",
    options.visibleTextSelector,
  ),
  externalSelectors: selectorsForType(
    caTargets,
    "ExternalResourceTargetIntegrity",
    options.externalSelector ?? DEFAULT_EXTERNAL_SELECTOR,
  ),
});

/**
 * Recompute target integrity from the HTML and compare it with the
 * `target` recorded in the CA. Throws `CaClientError` when the JWT
 * cannot be decoded.
 */
export const compareTargets = async (
  options: CompareTargetsOptions,
): Promise<TargetComparison> => {
  const caTargets = normalizeTargets(decodeCa(options.jwt).payload.target);
  const currentTargets = normalizeTargets(
    await extractTargetsFromHtml(
      options.html,
      extractOptionsFromCa(caTargets, options),
    ),
  );

  if (currentTargets.length === 0) {
    return { status: "html_no_targets" };
  }

  if (!areTargetsEqual(currentTargets, caTargets)) {
    return {
      status: "drifted",
      current: currentTargets,
      expected: caTargets,
    };
  }

  return { status: "ok" };
};
