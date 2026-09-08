/** 問題の種類を識別する URL の基底 */
const REFERENCE = "https://docs.originator-profile.org/error-reference/";

/**
 * 問題の種類を識別する URL を組み立てる
 *
 * VC DM 2.0 は {@link ProblemDetails.type} を URL と規定している。検証パッケージの
 * エラーは `code` (`ERR_*`) を持つため、それをエラーリファレンスの URL に対応させる。
 * @param code エラーコードまたは通知の識別子
 */
export const problemType = (code: string): string => `${REFERENCE}${code}/`;

/**
 * 検証中の通知の種類
 *
 * 検証失敗を表す種類には各エラークラスの `code` を用いる。ここで定義するのは、
 * 失敗として扱わない通知の種類。
 */
export const ProblemType = {
  /** 非推奨の Certificate を検出した */
  CertificateDeprecated: problemType("WARN_CERTIFICATE_DEPRECATED"),
  /** Content Attestation の allowedOrigin は非推奨 */
  AllowedOriginDeprecated: problemType("WARN_ALLOWED_ORIGIN_DEPRECATED"),
  /** digestSRI が設定されていない */
  DigestSriMissing: problemType("WARN_DIGEST_SRI_MISSING"),
  /** digestSRI の検証に失敗した */
  DigestSriInvalid: problemType("WARN_DIGEST_SRI_INVALID"),
  /** Profile Annotation Issuer がその認証制度の発行を認可されていない */
  PaIssuerNotRegistered: problemType("INFO_PA_ISSUER_NOT_REGISTERED"),
  /** 種類が特定されていない通知 */
  Unspecified: problemType("UNSPECIFIED"),
} as const;

export type ProblemType = (typeof ProblemType)[keyof typeof ProblemType];
