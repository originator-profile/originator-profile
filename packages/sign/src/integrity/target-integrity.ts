import type { RawTarget, Target } from "@originator-profile/model";
import {
  createIntegrityMetadata,
  supportedHashAlgorithms,
  type HashAlgorithm,
} from "websri";
import type { ContentFetcher, ElementSelector } from "./types";

/** element.outerHTML and join("") */
export const fetchHtmlContent: ContentFetcher = async (elements) => {
  const text: string = elements
    .map((element): string => element.outerHTML)
    .join("");

  return [new Response(text)];
};

/** element.textContent and join("") */
export const fetchTextContent: ContentFetcher = async (elements) => {
  const text: string = elements
    .map((element): string => element.textContent ?? "")
    .join("");

  return [new Response(text)];
};

/** element.innerText and join("") */
export const fetchVisibleTextContent: ContentFetcher = async (elements) => {
  const text: string = elements
    .map((element): string => element.innerText)
    .join("");

  return [new Response(text)];
};

/**
 * Fetches external resources from elements by using their `currentSrc` or `src` property.
 * HTMLImageElement (<img>) and HTMLMediaElement (<video>, <audio>) support the `currentSrc` property,
 * which represents the actual source URL currently in use after source selection (e.g., <img srcset>, <video> with multiple <source>).
 * `currentSrc` is preferred over `src` because it reflects the final selected resource, ensuring integrity checks are performed on the actual loaded content.
 * Falls back to `src` if `currentSrc` is not available.
 */
export const fetchExternalResource: ContentFetcher = async (
  elements,
  fetcher = fetch,
) => {
  return await Promise.all(
    elements.map(async (element: unknown) => {
      const el = element as HTMLElement & { src?: string; currentSrc?: string };
      // HTMLMediaElement and HTMLImageElement support currentSrc property
      // which represents the actual selected source URL
      const src = el.currentSrc || el.src;
      if (!src) {
        throw new Error("Element has no src or currentSrc property");
      }
      return await fetcher(src);
    }),
  );
};

export const selectByCss: ElementSelector = (params) => {
  return Array.from(
    params.document.querySelectorAll(params.cssSelector as string),
  );
};

export const selectByIntegrity: ElementSelector = (params) => {
  return selectByCss({
    ...params,
    cssSelector: `[integrity=${JSON.stringify(String(params.integrity))}]`,
  });
};

/**
 * Target Integrity の作成
 *
 * `ExternalResourceTargetIntegrity` で複数のコンテンツが指定された場合、それぞれのハッシュ値がスペース区切りで結合されます。
 *
 * @see {@link https://docs.originator-profile.org/opb/content-integrity-descriptor/}
 * @example
 * 基本的な使用例
 * ```ts
 * const content = {
 *   type: "HtmlTargetIntegrity", // or ***TargetIntegrity
 *   cssSelector: "<CSS セレクター>",
 * };
 *
 * const { integrity } = await createIntegrity("sha256", content);
 * console.log(integrity); // sha256-...
 * ```
 *
 * @example
 * ExternalResourceTargetIntegrity で複数コンテンツ
 * ```ts
 * const content = {
 *   type: "ExternalResourceTargetIntegrity",
 *   content: ["<コンテンツURL1>", "<コンテンツURL2>"],
 * };
 *
 * const { integrity } = await createIntegrity("sha256", content);
 * console.log(integrity); // sha256-... sha256-...
 * ```
 */
export async function createIntegrity(
  alg: HashAlgorithm,
  { content = "", ...target }: RawTarget,
  doc?: Document,
): Promise<Target | null> {
  if (
    ![
      "TextTargetIntegrity",
      "VisibleTextTargetIntegrity",
      "HtmlTargetIntegrity",
      "ExternalResourceTargetIntegrity",
    ].includes(target.type)
  ) {
    return null;
  }

  if (!(alg in supportedHashAlgorithms)) {
    return null;
  }

  if (target.type === "ExternalResourceTargetIntegrity") {
    const meta = await Promise.all(
      [content].flat().map(async (content) => {
        const res = URL.canParse(content)
          ? await fetch(content)
          : new Response(content);

        const data = await res.arrayBuffer();
        return await createIntegrityMetadata(alg, data);
      }),
    );

    return {
      ...target,
      integrity: meta.join(" "),
    } as Target;
  }

  doc ??= document;

  const { contentFetcher, elementSelector } = {
    HtmlTargetIntegrity: {
      contentFetcher: fetchHtmlContent,
      elementSelector: selectByCss,
    },
    TextTargetIntegrity: {
      contentFetcher: fetchTextContent,
      elementSelector: selectByCss,
    },
    VisibleTextTargetIntegrity: {
      contentFetcher: fetchVisibleTextContent,
      elementSelector: selectByCss,
    },
  }[target.type];

  const elements = elementSelector({ ...target, document: doc });

  if (elements.length === 0) return null;

  const [res] = await contentFetcher(elements);

  if (!res) return null;

  const data = await res.arrayBuffer();
  const meta = await createIntegrityMetadata(alg, data);

  return {
    ...target,
    integrity: meta.toString(),
  } as Target;
}
