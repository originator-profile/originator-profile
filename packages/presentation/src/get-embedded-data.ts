/**
 * 文書内の指定された mediaType の埋め込みデータを取得する
 * @param doc Document オブジェクト
 * @param mediaType メディアタイプ
 */
export function getEmbeddedData<T extends unknown[]>(
  doc: Document,
  mediaType: string,
): T {
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
