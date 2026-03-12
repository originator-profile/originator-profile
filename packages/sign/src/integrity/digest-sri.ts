import {
  createIntegrityMetadata,
  HashAlgorithm,
  supportedHashAlgorithms,
} from "websri";
import type { DigestSriContent, DigestSriSource } from "./types";

/**
 * `digestSRI` の作成
 *
 * `content` にアクセスし `digestSRI` を計算します。
 * なお、`content` プロパティは削除されます。
 * `content` プロパティが存在しない場合、`id` にアクセスし `digestSRI` 計算します。
 *
 * 複数のコンテンツが指定された場合、それぞれのハッシュ値がスペース区切りで結合されます。
 *
 * @see {@link https://www.w3.org/TR/SRI/#the-integrity-attribute}
 * @example
 * 単一コンテンツ
 * ```ts
 * const resource = {
 *   id: "<URL>",
 *   content: "<コンテンツ (URL)>", // 省略可能
 * };
 *
 * const { digestSRI } = await createDigestSri("sha256", resource);
 * console.log(digestSRI); // sha256-...
 * ```
 *
 * @example
 * 複数コンテンツ
 * ```ts
 * const resource = {
 *   id: "<URL>",
 *   content: ["<コンテンツURL1>", "<コンテンツURL2>"],
 * };
 *
 * const { digestSRI } = await createDigestSri("sha256", resource);
 * console.log(digestSRI); // sha256-... sha256-...
 * ```
 */
export async function createDigestSri(
  alg: HashAlgorithm,
  resource: DigestSriSource,
  fetcher = fetch,
): Promise<DigestSriContent> {
  if (!(alg in supportedHashAlgorithms)) {
    return { id: resource.id };
  }

  const meta = await Promise.all(
    [resource.content ?? resource.id].flat().map(async (content) => {
      const res = await fetcher(content);
      const data = await res.arrayBuffer();
      return await createIntegrityMetadata(alg, data);
    }),
  );

  return {
    id: resource.id,
    digestSRI: meta.join(" "),
  };
}
