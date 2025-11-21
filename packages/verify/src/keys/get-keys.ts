import { LocalKeys, type Keys } from "@originator-profile/cryptography";
import { Jwks } from "@originator-profile/model";
import { DecodedOps } from "../originator-profile-set";

type OpId = string;

/**
 * OPS から鍵を取得する
 * @returns OP ID, JWKS の連想配列
 */
export function getMappedKeys(ops: DecodedOps): Record<OpId, Jwks> {
  const groupedOps = Object.groupBy(
    ops,
    (op) => op.core.doc.credentialSubject.id,
  );
  const keyMap: Record<OpId, Jwks> = {};
  for (const [opId, ops] of Object.entries(groupedOps)) {
    if (!ops) continue;
    const kidSet = new Set<string>();
    const keys = ops
      .flatMap((op) => op.core.doc.credentialSubject.jwks.keys)
      .filter(({ kid }) => !kidSet.has(kid) && kidSet.add(kid));
    keyMap[opId] = { keys };
  }
  return keyMap;
}

export type MappedKeys = ReturnType<typeof getMappedKeys>;

/**
 * OPS から鍵を取得する
 * @returns OP ID, Keys のタプル
 * @remarks
 *
 * この実装は複数のissuerと鍵束を一つの組にするので、
 * 事前にissuerが特定できる場合にはgetMappedKeys()を優先して使用すべきです
 *
 * @see https://github.com/originator-profile/originator-profile/issues/90
 */
export function getTupledKeys(ops: DecodedOps): [opId: OpId | OpId[], Keys] {
  const keyMap = getMappedKeys(ops);
  const kidSet = new Set<string>();
  const opId = Object.keys(keyMap);
  const keys = Object.values(keyMap)
    .flatMap((jwks) => jwks.keys)
    .filter(({ kid }) => !kidSet.has(kid) && kidSet.add(kid));
  return [opId.length === 1 ? opId[0] : opId, LocalKeys({ keys })];
}

export type TupledKeys = ReturnType<typeof getTupledKeys>;
