import { isRecord } from "../is-record";
import {
  DEFAULT_EXTERNAL_SELECTOR,
  extractTargetsFromHtml,
  type ExtractTargetsOptions,
} from "../targets/html";

type NormalizedTarget = {
  type: string;
  integrity: string;
  cssSelector?: string;
};

export type TargetDrift =
  | { status: "ok" }
  | { status: "html_no_targets" }
  | {
      status: "drifted";
      current: NormalizedTarget[];
      expected: NormalizedTarget[];
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
    // CAS may omit cssSelector. The extracted target still has one.
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

const selectorsForType = (
  casTargets: NormalizedTarget[],
  type: string,
): string[] => [
  ...new Set(
    casTargets.flatMap((target) =>
      target.type === type && typeof target.cssSelector === "string"
        ? [target.cssSelector]
        : [],
    ),
  ),
];

const extractOptionsFromCas = (
  casTargets: NormalizedTarget[],
): ExtractTargetsOptions => {
  const externalSelectors = selectorsForType(
    casTargets,
    "ExternalResourceTargetIntegrity",
  );
  return {
    textSelectors: selectorsForType(casTargets, "TextTargetIntegrity"),
    htmlSelectors: selectorsForType(casTargets, "HtmlTargetIntegrity"),
    visibleTextSelectors: selectorsForType(
      casTargets,
      "VisibleTextTargetIntegrity",
    ),
    externalSelectors:
      externalSelectors.length > 0
        ? externalSelectors
        : [DEFAULT_EXTERNAL_SELECTOR],
  };
};

export const targetDrift = async ({
  html,
  payload,
}: {
  html: string;
  payload: Record<string, unknown>;
}): Promise<TargetDrift> => {
  const expected = normalizeTargets(payload.target);
  const current = normalizeTargets(
    await extractTargetsFromHtml(html, extractOptionsFromCas(expected)),
  );

  if (current.length === 0) {
    return { status: "html_no_targets" };
  }

  if (!areTargetsEqual(current, expected)) {
    return { status: "drifted", current, expected };
  }

  return { status: "ok" };
};
