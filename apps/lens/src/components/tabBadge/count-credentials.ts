import {
  deduplicateCas,
  type TabVerification,
} from "@originator-profile/extension-common";
import type { VerifiedCas } from "@originator-profile/verify";
import { toLegacyDocument } from "../../utils/to-legacy-result";

/**
 * タブのバッジに表示するクレデンシャルの件数を数える
 *
 * 確定した文書の Content Attestation を重複を除いて数える。いずれかの文書が
 * 検証に失敗しているか、結果が無効になっていれば 0 とする。
 * fenced frame の結果は数えない。
 * @param verification タブが表示している文書群の検証の状態
 */
export function countCredentials({ frames }: TabVerification): number {
  const cas: VerifiedCas = [];
  for (const { frame, entry } of frames) {
    if (frame.frameType === "fenced_frame") continue;
    if (entry?.state === "invalidated") return 0;
    if (entry?.state !== "settled") continue;
    const legacy = toLegacyDocument(entry.result);
    if (legacy instanceof Error) return 0;
    cas.push(...legacy.cas);
  }
  return deduplicateCas(cas).length;
}
