import { OriginatorProfileSet } from "@originator-profile/model";
import { OpsVerifier, getTupledKeys } from "@originator-profile/verify";
import { CoreProfileIssuersDebugResult } from "../types.js";

export async function runOpsVerification(
  ops: OriginatorProfileSet,
  coreProfileIssuers: CoreProfileIssuersDebugResult,
) {
  const [issuer, keys] = getTupledKeys(coreProfileIssuers.decoded);
  const opsVerifier = OpsVerifier(
    [...coreProfileIssuers.ops, ...ops],
    keys,
    issuer,
  );
  return await opsVerifier();
}
