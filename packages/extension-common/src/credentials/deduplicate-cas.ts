import type { ContentAttestation } from "@originator-profile/model";
import type { CasItem, VerifiedCa } from "@originator-profile/verify";

/**
 * 検証済みCAS配列から重複を排除する。
 * issuer と credentialSubject.id の複合キーで同一性を判定し、
 * 同一キーが複数存在する場合は後勝ちとする。
 *
 * CasItem の形(main/attestation)ごとジェネリックにしており、
 * source のような追加プロパティが付与されていてもそのまま残る。
 */
export function deduplicateCas<
  T extends CasItem<VerifiedCa<ContentAttestation>>,
>(cas: T[]): T[] {
  return Array.from(
    new Map(
      cas.map((ca) => [
        `${ca.attestation.doc.issuer}:${ca.attestation.doc.credentialSubject.id}`,
        ca,
      ]),
    ).values(),
  );
}
