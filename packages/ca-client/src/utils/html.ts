import { JSDOM } from "jsdom";

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
