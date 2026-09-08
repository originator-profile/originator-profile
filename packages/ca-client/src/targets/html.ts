import { createIntegrity } from "@originator-profile/sign";
import { JSDOM } from "jsdom";

export type ExtractedTarget = {
  type: string;
  integrity: string;
  cssSelector?: string;
};

export type ExtractTargetsOptions = {
  textSelectors?: string[];
  htmlSelectors?: string[];
  visibleTextSelectors?: string[];
  /** CSS selectors for ExternalResourceTargetIntegrity elements */
  externalSelectors?: string[];
};

/**
 * Default selector for ExternalResourceTargetIntegrity when CAS has no
 * cssSelector and the caller omitted `externalSelector`.
 */
export const DEFAULT_EXTERNAL_SELECTOR = ".target-integrity";

const uniqueSelectors = (selectors: string[] | undefined): string[] => [
  ...new Set((selectors ?? []).filter((selector) => selector.length > 0)),
];

const toExtractedTarget = (
  type: string,
  integrity: string,
  cssSelector?: string,
): ExtractedTarget =>
  cssSelector === undefined
    ? { type, integrity }
    : { type, integrity, cssSelector };

export const extractExternalTargetIntegrities = (
  document: Document,
  cssSelectors: string[] = [DEFAULT_EXTERNAL_SELECTOR],
): ExtractedTarget[] =>
  uniqueSelectors(cssSelectors).flatMap((cssSelector) => {
    const targets: ExtractedTarget[] = [];
    for (const element of document.querySelectorAll(cssSelector)) {
      const integrity = element.getAttribute("integrity");
      if (integrity && /^sha(256|384|512)-/.test(integrity)) {
        targets.push(
          toExtractedTarget(
            "ExternalResourceTargetIntegrity",
            integrity,
            cssSelector,
          ),
        );
      }
    }
    return targets;
  });

const extractDomTargets = async (
  document: Document,
  type:
    | "TextTargetIntegrity"
    | "HtmlTargetIntegrity"
    | "VisibleTextTargetIntegrity",
  selectors: string[] | undefined,
): Promise<ExtractedTarget[]> => {
  const extracted = await Promise.all(
    uniqueSelectors(selectors).map(async (cssSelector) => {
      const target = await createIntegrity(
        "sha256",
        { type, cssSelector },
        document,
      );
      if (!target?.integrity) {
        return undefined;
      }
      return toExtractedTarget(target.type, target.integrity, cssSelector);
    }),
  );
  return extracted.filter((target) => target !== undefined);
};

/**
 * Extract target integrity from HTML. Selectors come from the caller
 * (CAS-recorded values or `DetectDriftOptions`); there is no site-specific default.
 */
export const extractTargetsFromHtml = async (
  htmlContent: string,
  options: ExtractTargetsOptions = {},
): Promise<ExtractedTarget[]> => {
  const document = new JSDOM(htmlContent).window.document;

  const [textTargets, htmlTargets, visibleTextTargets] = await Promise.all([
    extractDomTargets(document, "TextTargetIntegrity", options.textSelectors),
    extractDomTargets(document, "HtmlTargetIntegrity", options.htmlSelectors),
    extractDomTargets(
      document,
      "VisibleTextTargetIntegrity",
      options.visibleTextSelectors,
    ),
  ]);

  return [
    ...textTargets,
    ...htmlTargets,
    ...visibleTextTargets,
    ...extractExternalTargetIntegrities(document, options.externalSelectors),
  ];
};
