import type { OriginatorProfileSet } from "@originator-profile/model";
import {
  OpsInvalid,
  decodeOps,
  getTupledKeys,
  type TupledKeys,
} from "@originator-profile/verify";

/**
 * OP レジストリの OPS は VC（JWT）を含むため、コードへバンドルせず
 * 拡張機能内の registry-ops.json として配置し、実行時に読み込む。
 */
let cache: Promise<{ ops: OriginatorProfileSet; keys: TupledKeys }> | undefined;

function load() {
  cache ??= (async () => {
    const url = chrome.runtime.getURL("registry-ops.json");
    const ops = (await fetch(url).then((res) =>
      res.json(),
    )) as OriginatorProfileSet;

    const decoded = decodeOps(ops);
    if (decoded instanceof OpsInvalid) {
      throw decoded;
    }
    return { ops, keys: getTupledKeys(decoded) };
  })();
  return cache;
}

/**
 * OP レジストリの OPS を取得する
 */
export async function getRegistryOps(): Promise<OriginatorProfileSet> {
  return (await load()).ops;
}

/**
 * OP レジストリの JWKS を取得する
 * @returns レジストリの Issuer, JWKS のタプル
 */
export async function getRegistryKeys(): Promise<TupledKeys> {
  return (await load()).keys;
}
