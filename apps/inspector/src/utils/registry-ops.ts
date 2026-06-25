import type { OriginatorProfileSet } from "@originator-profile/model";
import {
  OpsInvalid,
  decodeOps,
  getTupledKeys,
  type TupledKeys,
} from "@originator-profile/verify";

type OpsCache = {
  ops: OriginatorProfileSet;
  keys: TupledKeys;
};

const cacheKey = Symbol("opsCache");
const cache: Map<typeof cacheKey, OpsCache> = new Map();

/**
 * Core Profile Issuer の OPS を取得
 *
 * 難読化ポリシー対応のため OPS（VC/JWT）は JS バンドルへ含めず、
 * 拡張機能ルートへ配置した registry-ops.json を実行時に読み込む。
 * @returns OPS
 */
export async function getRegistryOps(): Promise<OpsCache> {
  const cachedOps = cache.get(cacheKey);
  if (cachedOps) return cachedOps;

  const ops = await fetch(chrome.runtime.getURL("registry-ops.json")).then(
    (res) => res.json() as Promise<OriginatorProfileSet>,
  );

  const res = decodeOps(ops);
  if (res instanceof OpsInvalid) {
    throw res;
  }

  const keys = getTupledKeys(res);

  const opsCache: OpsCache = {
    ops,
    keys,
  };

  cache.set(cacheKey, opsCache);
  return opsCache;
}
