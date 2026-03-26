import { OpMeta } from "@originator-profile/model";
import { FetchOpMetaResult } from "./types";

/**
 * 文書内の指定された mediaType の埋め込みデータを取得する
 * @param doc Document オブジェクト
 * @param mediaType メディアタイプ
 */
function getEmbeddedData<T>(doc: Document, mediaType: string): T {
  const elements = [...doc.querySelectorAll(`script[type="${mediaType}"]`)];
  const dataArray = elements
    .map((elem) => {
      const text = elem.textContent;
      if (typeof text !== "string") {
        return undefined;
      }
      try {
        const json = JSON.parse(text);
        return json;
      } catch (e: unknown) {
        return undefined;
      }
    })
    .filter((e) => typeof e !== "undefined");

  return dataArray.flat() as T;
}

function isValidOpMeta(value: unknown): value is OpMeta {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const opMeta = value as { targetopid?: unknown };
  return typeof opMeta.targetopid === "string" && opMeta.targetopid.length > 0;
}

/**
 * OpMeta の取得
 * @param doc Document オブジェクト
 */
export const fetchOpMeta = (doc: Document): FetchOpMetaResult => {
  const opMetas = getEmbeddedData<OpMeta[]>(doc, "application/opmeta+json");

  if (opMetas.length > 1) {
    console.warn(
      "Multiple OpMeta elements found. Only the first one will be used.",
    );
  }

  const firstOpMeta = opMetas[0];
  if (!isValidOpMeta(firstOpMeta)) {
    return undefined;
  }
  return firstOpMeta;
};
