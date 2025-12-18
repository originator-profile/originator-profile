import { OpVc } from "@originator-profile/model";
import { JOSEError, JWTInvalid } from "jose/errors";
import {
  UnverifiedVc,
  VcDecodingFailure,
  VcDecodingResult,
  VcValidationFailure,
  VcValidationResult,
  VcVerificationFailure,
  VcVerificationResult,
  VerifiedVc,
} from "../types";

/** 未復号 VC */
export type UndecodedJwtVc = {
  /** JWT */
  source: string;
};

/** 未検証 JWT VC */
export type UnverifiedJwtVc<T extends OpVc> = UndecodedJwtVc & UnverifiedVc<T>;

/** 検証済み JWT VC */
export type VerifiedJwtVc<T extends OpVc> = UnverifiedJwtVc<T> & VerifiedVc<T>;

/** JWT VC 復号失敗 */
export type JwtVcDecodingFailure = VcDecodingFailure<
  UndecodedJwtVc,
  JWTInvalid | TypeError
>;

/** JWT VC 検証失敗 */
export type JwtVcVerificationFailure = VcVerificationFailure<
  UndecodedJwtVc,
  JOSEError
>;

/** JWT VC 妥当性確認結果 */
export type JwtVcValidationResult<T extends OpVc> = VcValidationResult<
  VerifiedJwtVc<T>,
  VcValidationFailure<VerifiedJwtVc<T>>
>;

/** JWT VC 復号結果 */
export type JwtVcDecodingResult<T extends OpVc> = VcDecodingResult<
  UnverifiedJwtVc<T>,
  JwtVcDecodingFailure
>;

/** JWT VC 検証結果 */
export type JwtVcVerificationResult<T extends OpVc> =
  | VcVerificationResult<VerifiedJwtVc<T>, JwtVcVerificationFailure>
  | JwtVcValidationResult<T>;
