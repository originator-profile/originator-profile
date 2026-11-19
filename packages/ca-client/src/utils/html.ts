import { JSDOM } from "jsdom";

// 先頭の BOM は parse5 に文字として扱われ <head> が暗黙になるので、同じ長さの空白に替えて位置を保つ。
export const parseHtml = (html: string): JSDOM =>
  new JSDOM(html.replace(/^\uFEFF/, " "), { includeNodeLocations: true });

type NodeLocation = NonNullable<ReturnType<JSDOM["nodeLocation"]>>;
// parse5 の ElementLocation 相当。要素以外の位置情報との差分は省略可能なプロパティだけなので、注釈だけで代入できる。
type ElementLocation = NodeLocation & {
  startTag?: NodeLocation & { attrs?: Record<string, NodeLocation> };
  endTag?: NodeLocation;
};

export const elementLocation = (
  dom: JSDOM,
  element: Element,
): ElementLocation | undefined => dom.nodeLocation(element) ?? undefined;
