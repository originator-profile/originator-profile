import { embeddedSource, SourcedCredential } from "./credentials/types";

/**
 * 指定されたメディアタイプのいずれかを type 属性に持つ script 要素のセレクター
 * @param mediaTypes メディアタイプ
 * @param attributes 追加の属性セレクター
 */
export function scriptSelector(
  mediaTypes: string | readonly string[],
  attributes = "",
): string {
  return [mediaTypes]
    .flat()
    .map((mediaType) => `script${attributes}[type="${mediaType}"]`)
    .join(", ");
}

/**
 * 文書内の指定された mediaType の埋め込みデータを取得する
 * @param doc Document オブジェクト
 * @param mediaTypes メディアタイプ (複数指定時はいずれかに一致する要素を文書順に取得)
 */
export function getEmbeddedData<T extends unknown[]>(
  doc: Document,
  mediaTypes: string | readonly string[],
): SourcedCredential<T[number]>[] {
  const elements = [...doc.querySelectorAll(scriptSelector(mediaTypes))];

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
    const items = (Array.isArray(json) ? json : [json]) as T[number][];
    return items.map((credential) => ({
      credential: credential,
      source: embeddedSource(elementIndex),
    }));
  });
}
