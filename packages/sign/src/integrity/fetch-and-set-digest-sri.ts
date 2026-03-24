import type { HashAlgorithm } from "websri";
import { createDigestSri } from "./digest-sri";
import type { DigestSriResult, DigestSriSource } from "./types";

/**
 * オブジェクトへの `digestSRI` の割り当て
 *
 * `digestSRI` を省略した場合、`content` にアクセスし `digestSRI` を計算します。
 * なお、`content` プロパティは削除されます。
 * `content` プロパティが存在しない場合、`id` にアクセスし `digestSRI` 計算します。
 * @see {@link https://www.w3.org/TR/SRI/#the-integrity-attribute}
 * @example
 * ```ts
 * const resource = {
 *   id: "<URL>",
 *   content: "<コンテンツ (URL)>", // 省略可能
 * };
 *
 * await fetchAndSetDigestSri("sha256", resource);
 *
 * console.log(resource);
 * // {
 * //   id: "<URL>",
 * //   digestSRI: "sha256-..."
 * // }
 * ```
 */
export async function fetchAndSetDigestSri(
  alg: HashAlgorithm,
  content: unknown,
): Promise<DigestSriResult | undefined> {
  if (!content) return content as undefined;

  if (typeof (content as DigestSriResult).digestSRI !== "string") {
    Object.assign(
      content,
      await createDigestSri(alg, content as DigestSriSource),
    );
  }

  delete (content as DigestSriSource).content;

  return content as DigestSriResult;
}
