import type { OriginatorProfileSet } from "@originator-profile/model";
import {
  OpsInvalid,
  decodeOps,
  getTupledKeys,
  type TupledKeys,
} from "@originator-profile/verify";
import registryOpsData from "./registry-ops.generated.json" with { type: "json" };

export const registryOps = registryOpsData as unknown as OriginatorProfileSet;

export function getRegistryKeys(): TupledKeys {
  const ops = decodeOps(registryOps);
  if (ops instanceof OpsInvalid) {
    throw ops;
  }
  return getTupledKeys(ops);
}
