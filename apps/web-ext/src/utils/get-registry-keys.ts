import { OriginatorProfileSet } from "@originator-profile/model";
import {
  OpsInvalid,
  decodeOps,
  getTupledKeys,
  type OpsDecodingResult,
  type TupledKeys,
} from "@originator-profile/verify";

const REGISTRY_OPS: OriginatorProfileSet = import.meta.env.REGISTRY_OPS;
/**
 * OP レジストリの OPS を取得する
 * @returns レジストリのOPS復号結果
 */
function getRegistryOps(): OpsDecodingResult {
  return decodeOps(REGISTRY_OPS);
}

/**
 * OP レジストリの JWKS を取得する
 * @returns レジストリの Issuer, JWKS のタプル
 */
export function getRegistryKeys(): TupledKeys {
  const registryOps = getRegistryOps();
  if (registryOps instanceof OpsInvalid) {
    throw registryOps;
  }

  return getTupledKeys(registryOps);
}
