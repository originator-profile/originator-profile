import type { OriginatorProfileSet } from "@originator-profile/model";
import { prepareRegistry, type Registry } from "@originator-profile/verify";

const cacheKey = Symbol("registry");
const cache: Map<typeof cacheKey, Registry> = new Map();

/**
 * Core Profile 発行者のレジストリを取得
 *
 * 難読化ポリシー対応のため OPS（VC/JWT）は JS バンドルへ含めず、
 * 拡張機能ルートへ配置した registry-ops.json を実行時に読み込む。
 * @returns レジストリ
 */
export async function getRegistry(): Promise<Registry> {
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const ops = await fetch(chrome.runtime.getURL("registry-ops.json")).then(
    (res) => res.json() as Promise<OriginatorProfileSet>,
  );

  const registry = prepareRegistry(ops);
  if (registry instanceof Error) {
    throw registry;
  }

  cache.set(cacheKey, registry);
  return registry;
}
