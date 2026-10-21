import type { RawTarget, Target } from "@originator-profile/model";
import {
  createIntegrityMetadata,
  supportedHashAlgorithms,
  type HashAlgorithm,
} from "websri";
import { FetchFailed } from "./error";
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

type SourceSelectableElement = Element & { src: string; currentSrc: string };

/** `srcset` 属性の候補の URL (未解決) を取り出す。記述子は読み飛ばす。 */
function parseSrcsetUrls(srcset: string): string[] {
  const urls: string[] = [];
  const url = /[\s,]*(\S+)/y;
  // NOTE: 記述子の括弧内のカンマは候補の区切りではない
  const descriptors = /(?:\([^)]*\)?|[^,(])*/y;

  for (let match = url.exec(srcset); match; match = url.exec(srcset)) {
    const token = match[1] ?? "";

    if (token.endsWith(",")) {
      urls.push(token.replace(/,+$/, ""));
      continue;
    }

    urls.push(token);
    descriptors.lastIndex = url.lastIndex;
    descriptors.exec(srcset);
    url.lastIndex = descriptors.lastIndex;
  }

  return urls.filter(Boolean);
}

/**
 * `currentSrc` が空なら `src` を返す
 *
 * NOTE: JSDOM (cas-monitor) は `currentSrc` を実装しておらず常に空文字を返す。
 * ブラウザーでも読み込み前の要素では空になる。
 */
const currentSrcOrSrc = (element: Element): string[] => {
  const el = element as SourceSelectableElement;
  const url = el.currentSrc || el.src;
  return url ? [url] : [];
};

const srcOf = (element: Element): string[] => {
  const url = (element as SourceSelectableElement).src;
  return url ? [url] : [];
};

const resolvePictureUrls = (picture: Element): string[] => {
  const img = picture.querySelector(":scope > img");
  return img ? currentSrcOrSrc(img) : [];
};

/** `srcset` 属性のすべての候補を解決した URL を返す */
const resolveSrcsetUrls = (source: Element): string[] =>
  parseSrcsetUrls(source.getAttribute("srcset") ?? "")
    .filter((candidate) => URL.canParse(candidate, source.baseURI))
    .map((candidate) => new URL(candidate, source.baseURI).href);

function resolveSourceUrls(source: Element): string[] {
  switch (source.parentElement?.localName) {
    case "picture":
      return resolveSrcsetUrls(source);
    case "video":
    case "audio":
      return srcOf(source);
    default:
      return [];
  }
}

// NOTE: cas-monitor では JSDOM の要素を扱うため instanceof ではなく localName で判定する
const externalResourceUrlResolvers = new Map<
  string,
  (element: Element) => string[]
>([
  ["img", currentSrcOrSrc],
  ["picture", resolvePictureUrls],
  ["source", resolveSourceUrls],
  ["video", currentSrcOrSrc],
  ["audio", currentSrcOrSrc],
  ["track", srcOf],
]);

/**
 * External Resource Integrity の対象要素について、取得する URL を返す
 *
 * 対象要素でない場合は空配列を返す。
 *
 * @see {@link https://docs.originator-profile.org/opb/content-integrity-descriptor/external-resource/#target-elements}
 */
export const resolveExternalResourceUrls = (element: Element): string[] =>
  externalResourceUrlResolvers.get(element.localName)?.(element) ?? [];

/**
 * 要素の外部リソースを取得する
 *
 * URL は {@link resolveExternalResourceUrls} で決める。1 つの要素に複数の URL があれば、そのすべてを取得する。
 * 対象要素でない要素が含まれる場合はエラーを投げるため、{@link selectExternalResources} で選択した要素を渡す。
 */
export const fetchExternalResource: ContentFetcher = async (
  elements,
  fetcher = fetch,
) => {
  const urls = elements.flatMap((element) => {
    const urls = resolveExternalResourceUrls(element);
    if (urls.length === 0) {
      throw new Error(
        `<${element.localName}> is not a target element of External Resource Integrity`,
      );
    }
    return urls;
  });

  return await Promise.all(
    urls.map(async (url) => {
      try {
        return await fetcher(url);
      } catch (e) {
        if (e instanceof Error || e instanceof window.Error) {
          throw new FetchFailed(`Failed to fetch`, e);
        }
        throw e;
      }
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
 * `ExternalResourceTargetIntegrity` の要素位置特定
 *
 * `cssSelector` があれば CSS セレクター、なければ `integrity` 属性で特定します。
 *
 * @see {@link https://docs.originator-profile.org/opb/content-integrity-descriptor/external-resource/#how-to-identify-element-location}
 */
export const selectByCssOrIntegrity: ElementSelector = (params) =>
  params.cssSelector === undefined
    ? selectByIntegrity(params)
    : selectByCss(params);

/**
 * `ExternalResourceTargetIntegrity` の検証対象の要素の選択
 *
 * {@link selectByCssOrIntegrity} で特定した要素のうち、取得する URL が決まるものに限る。
 *
 * @see {@link https://docs.originator-profile.org/opb/content-integrity-descriptor/external-resource/#target-elements}
 */
export const selectExternalResources: ElementSelector = (params) =>
  selectByCssOrIntegrity(params).filter(
    (element) => resolveExternalResourceUrls(element).length > 0,
  );

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
