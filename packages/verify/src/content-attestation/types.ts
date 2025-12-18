import { ContentAttestation } from "@originator-profile/model";
import {
  JwtVcDecodingResult,
  JwtVcVerificationResult,
  UnverifiedJwtVc,
  VerifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import { CaInvalid, CaVerifyFailed } from "./errors";

/** Content Attestation 復号失敗 */
export type CaDecodingFailure = JwtVcDecodingResult<ContentAttestation>;
/** 復号済み Content Attestation */
export type DecodedCa = UnverifiedJwtVc<ContentAttestation>;
/** Content Attestation 復号結果 */
export type CaDecodingResult = DecodedCa | CaInvalid;

/** Content Attestation 検証失敗 */
export type CaVerificationFailure = JwtVcVerificationResult<ContentAttestation>;
/** 検証済み Content Attestation */
export type VerifiedCa<T extends ContentAttestation = ContentAttestation> =
  VerifiedJwtVc<T>;
/** Content Attestation 検証結果 */
export type CaVerificationResult<
  T extends ContentAttestation = ContentAttestation,
> = VerifiedCa<T> | CaInvalid | CaVerifyFailed;
