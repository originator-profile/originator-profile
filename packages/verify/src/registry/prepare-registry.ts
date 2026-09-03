import type { Keys } from "@originator-profile/cryptography";
import type { OriginatorProfileSet } from "@originator-profile/model";
import { getTupledKeys } from "../keys";
import { decodeOps, OpsInvalid } from "../originator-profile-set";

/** Core Profile 発行者 (レジストリ) の Originator Profile Set と検証鍵 */
export type Registry = {
  /** レジストリの Originator Profile Set */
  ops: OriginatorProfileSet;
  /** Core Profile の検証鍵 */
  keys: Keys;
  /** Core Profile の発行者 */
  issuer: string | string[];
};

/**
 * レジストリの Originator Profile Set から検証に用いる形を用意する
 * @param ops レジストリの Originator Profile Set
 * @returns Registry、または復号に失敗した場合は OpsInvalid
 *
 * @example
 * ```ts
 * const registry = prepareRegistry(await fetchRegistryOps());
 * if (registry instanceof Error) throw registry;
 * const verified = await verifyWebsite(origin, { siteProfile, registry });
 * ```
 */
export function prepareRegistry(
  ops: OriginatorProfileSet,
): Registry | OpsInvalid {
  const decoded = decodeOps(ops);
  if (decoded instanceof OpsInvalid) {
    return decoded;
  }
  const [issuer, keys] = getTupledKeys(decoded);
  return { ops, keys, issuer };
}
