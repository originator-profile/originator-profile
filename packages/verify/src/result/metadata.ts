import type { SecuringResult } from "./types";

/** 検証に用いた入力の出所 */
export type InputSource =
  | { kind: "registry" }
  | { kind: "site-profile" }
  | { kind: "document"; url: string };

/**
 * 検証結果が併せて持つ情報
 *
 * @see https://docs.originator-profile.org/ja/opb/verifier-processing-model/
 */
export type VerificationMetadata<Category extends string> = {
  /** 検証時刻 (ISO 8601) */
  verifiedAt: string;
  /**
   * 結果が有効である時刻の境界 (ISO 8601)
   *
   * 用いた VC の有効期間の開始と終了のうち、検証時刻より後で最も早いもの。
   */
  validUntil?: string;
  /** 適用した検証のカテゴリー */
  scope: Category[];
  /** 検証に用いた入力の出所 */
  inputRange: InputSource[];
};

/**
 * 時刻の境界
 *
 * 用いた VC の有効期間の開始と終了 (iat、exp、validFrom、validUntil) のうち、
 * 検証時刻より後で最も早いもの。
 */
export function timeBoundaryOf(
  securingResults: SecuringResult[],
  verifiedAt: string,
): string | undefined {
  const start = Date.parse(verifiedAt);
  const times = securingResults
    .flatMap(({ issuedAt, expiredAt, validFrom, validUntil }) => [
      issuedAt,
      expiredAt,
      validFrom,
      validUntil,
    ])
    .flatMap((value) => (value ? [Date.parse(value)] : []))
    .filter((time) => time > start);
  if (times.length === 0) return undefined;
  return new Date(Math.min(...times)).toISOString();
}
