import {
  OpsInvalid,
  decodeOps,
  getTupledKeys,
  type TupledKeys,
} from "@originator-profile/verify";
import { loadRegistryOps } from "./load-registry-ops";

/**
 * OP レジストリの JWKS を取得する
 * @returns レジストリの Issuer, JWKS のタプル
 */
export async function getRegistryKeys(): Promise<TupledKeys> {
  const registryOps = decodeOps(await loadRegistryOps());
  if (registryOps instanceof OpsInvalid) {
    throw registryOps;
  }
  return getTupledKeys(registryOps);
}
