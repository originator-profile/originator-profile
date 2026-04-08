import type { Jwk, OpVc } from "@originator-profile/model";
import type {
  VcDecodeFailed,
  VcValidateFailed,
  VcVerifyFailed,
} from "./errors";

/** 未復号 VC */
export type UndecodedVc = {
  /** ソース */
  source: unknown;
};

/** 未検証 VC */
export type UnverifiedVc<T extends OpVc = OpVc> = UndecodedVc & {
  /** VC DM 2.0 文書 */
  doc: T;
  /** 発行日 */
  issuedAt?: Date;
  /** 有効期限 */
  expiredAt?: Date;
  /** メディアタイプ */
  mediaType?: string;
  /** 暗号アルゴリズム */
  algorithm?: string;
};

/** 検証済み VC */
export type VerifiedVc<T extends OpVc = OpVc> = UnverifiedVc<T> & {
  /** 検証鍵 */
  verificationKey: Jwk;
  /** 妥当性確認済みか否か */
  validated: boolean;
};

type WithError<V extends object, E extends Error = Error> = V & { error: E };

/** スキーマ検証エラーの issue */
export type SchemaIssue = { path: string; message: string };

/** スキーマ検証エラー */
export class SchemaValidationError extends Error {
  constructor(public issues: SchemaIssue[]) {
    super(issues.map((i) => `${i.path}: ${i.message}`).join("; "));
    this.name = "SchemaValidationError";
  }
}

/** VC 復号失敗 */
export type VcDecodingFailure<
  V extends UndecodedVc = UndecodedVc,
  E extends Error = Error,
> = WithError<V, E>;

/** VC 妥当性確認失敗 */
export type VcValidationFailure<V extends UnverifiedVc = UnverifiedVc> =
  WithError<V, SchemaValidationError>;

/** VC 検証失敗 */
export type VcVerificationFailure<
  V extends UndecodedVc = UndecodedVc,
  E extends Error = Error,
> = WithError<V, E>;

/** VC 復号結果 */
export type VcDecodingResult<
  Success extends UnverifiedVc,
  Failure extends VcDecodingFailure,
> = Success | VcDecodeFailed<Failure>;

/** VC 妥当性確認結果 */
export type VcValidationResult<
  Success extends UnverifiedVc,
  Failure extends VcValidationFailure,
> = Success | VcValidateFailed<VcValidationFailure<Failure>>;

/** VC 検証結果 */
export type VcVerificationResult<
  Success extends VerifiedVc,
  Failure extends VcVerificationFailure,
> = Success | VcVerifyFailed<VcVerificationFailure<Failure>>;
