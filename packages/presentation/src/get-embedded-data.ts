import { embeddedSource, SourcedCredential } from "./credentials/types";

/**
 * 文書内の指定された mediaType の埋め込みデータを取得する
 * @param doc Document オブジェクト
 * @param mediaType メディアタイプ
 */
export function getEmbeddedData<T extends unknown[]>(
  doc: Document,
  mediaType: string,
): SourcedCredential<T[number]>[] {
  const elements = [...doc.querySelectorAll(`script[type="${mediaType}"]`)];

  return elements.flatMap((elem, elementIndex) => {
    const text = elem.textContent;
    if (typeof text !== "string") {
      return [];
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (e: unknown) {
      return [];
    }
    const items = (Array.isArray(json) ? json : [json]) as T;
    return items.map((credential) => ({
      credential: credential,
      source: embeddedSource(elementIndex),
    }));
  });
}
