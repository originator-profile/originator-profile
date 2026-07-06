import type { Image } from "@originator-profile/model";
import {
  createDigestSri,
  type DigestSriResult,
} from "@originator-profile/sign";
import { IntegrityMetadataSet } from "websri";
import type { WarnHandler } from "../warn";

const WARN_SUFFIX = `This will become an error after 2027. See: https://docs.originator-profile.org/en/opb/context/#the-image-datatype`;

/**
 * `digestSRI` の検証
 * @see {@link https://www.w3.org/TR/SRI/#the-integrity-attribute}
 * @example
 * ```ts
 * const content = {
 *   id: "<URL>",
 *   digestSRI: "sha256-...",
 * };
 *
 * await verifyDigestSri(content); // true or false
 * ```
 */
export async function verifyDigestSri(
  content: DigestSriResult,
  fetcher = fetch,
): Promise<boolean> {
  const integrity = new IntegrityMetadataSet(content.digestSRI);
  const alg = integrity.strongestHashAlgorithms.filter(Boolean);

  if (alg.length === 0) return false;

  try {
    const result = await createDigestSri(alg[0], content, fetcher);
    return "digestSRI" in result && integrity.match(result.digestSRI);
  } catch (error) {
    console.error(
      "Failed to access content for digestSRI verification:",
      error,
    );
    return false;
  }
}

/**
 * Image の digestSRI を検証する。
 * 後方互換性の観点で、2027年までは検証失敗時に warn のみで処理を中断しない。
 */
export async function verifyImageDigestSri(
  value: Image | undefined,
  options: {
    /** コンテンツの取得に用いる fetch 実装 */
    fetcher?: typeof fetch;
    /** 警告ハンドラー (デフォルト: `console.warn`) */
    warn?: WarnHandler;
  } = {},
): Promise<void> {
  const { fetcher = fetch, warn = console.warn } = options;
  if (!value) return;

  if (!value.digestSRI) {
    warn(`digestSRI is missing. ${WARN_SUFFIX}`);
    return;
  }

  const valid = await verifyDigestSri(
    { id: value.id, digestSRI: value.digestSRI },
    fetcher,
  );
  if (!valid) {
    warn(`digestSRI verification failed. ${WARN_SUFFIX}`);
  }
}
