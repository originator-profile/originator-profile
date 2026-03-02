import type { Image } from "@originator-profile/model";
import {
  createDigestSri,
  type DigestSriContent,
} from "@originator-profile/sign";
import { IntegrityMetadataSet } from "websri";

const WARN_SUFFIX = `This will become an error after 2027. See: https://docs.originator-profile.org/`;

/**
 * `digestSRI` の検証
 * @see {@link https://www.w3.org/TR/SRI/#the-integrity-attribute}
 * @example
 * ```ts
 * const content: DigestSriContent = {
 *   id: "<URL>",
 *   digestSRI: "sha256-...",
 * };
 *
 * await verifyDigestSri(content); // true or false
 * ```
 */
export async function verifyDigestSri(
  content: DigestSriContent,
  fetcher = fetch,
): Promise<boolean> {
  const integrity = new IntegrityMetadataSet(content.digestSRI);
  const alg = integrity.strongestHashAlgorithms.filter(Boolean);

  if (alg.length === 0) return false;

  try {
    const { digestSRI } = await createDigestSri(alg[0], content, fetcher);
    return integrity.match(digestSRI);
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
 * 後方互換性の観点で、2027年までは検証失敗時に console.warn のみで処理を中断しない。
 */
export async function verifyImageDigestSri(
  value: Image | undefined,
): Promise<void> {
  if (!value) return;

  if (!value.digestSRI) {
    console.warn(`digestSRI is missing. ${WARN_SUFFIX}`);
    return;
  }

  const valid = await verifyDigestSri(value);
  if (!valid) {
    console.warn(`digestSRI verification failed. ${WARN_SUFFIX}`);
  }
}
