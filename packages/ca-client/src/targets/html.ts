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
  /** CSS selector for ExternalResourceTargetIntegrity elements */
  externalSelector?: string;
};

/**
 * Default selector for ExternalResourceTargetIntegrity when CAS に cssSelector が無く、
 * 引数も省略された場合。呼び出し側の `externalSelector` で上書きできる。
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
  cssSelector: string = DEFAULT_EXTERNAL_SELECTOR,
): ExtractedTarget[] => {
  const targets: ExtractedTarget[] = [];
  for (const element of document.querySelectorAll(cssSelector)) {
    const integrity = element.getAttribute("integrity");
    if (integrity && /^sha(256|384|512)-/.test(integrity)) {
      targets.push({
        type: "ExternalResourceTargetIntegrity",
        integrity,
      });
    }
  }
  return targets;
};

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
 * HTML から target integrity を抽出する。セレクタは呼び出し側（CAS または引数）が渡す。
 * CIP サイト前提の既定セレクタ（`article [itemprop='headline']` 等）は持たない。
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
    ...extractExternalTargetIntegrities(document, options.externalSelector),
  ];
};
