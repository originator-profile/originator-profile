import type { OriginatorProfileSet } from "@originator-profile/model";
import {
  OpsInvalid,
  decodeOps,
  getTupledKeys,
  type TupledKeys,
} from "@originator-profile/verify";

/**
 * Core Profile Issuer の OPS は VC（JWT）が難読化として誤検出される可能性あるので外部化
 * 拡張機能内の cp-issuer-ops.json として配置し、実行時に読み込む。
 */
let cache: Promise<{ ops: OriginatorProfileSet; keys: TupledKeys }> | undefined;

function load() {
  cache ??= (async () => {
    const url = chrome.runtime.getURL("cp-issuer-ops.json");
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
 * Core Profile Issuer の OPS を取得
 */
export async function getCpIssuerOps(): Promise<OriginatorProfileSet> {
  return (await load()).ops;
}

/**
 * Core Profile Issuer の JWKS を取得
 * @returns Core Profile Issuer の Issuer, JWKS のタプル
 */
export async function getCpIssuerKeys(): Promise<TupledKeys> {
  return (await load()).keys;
}
