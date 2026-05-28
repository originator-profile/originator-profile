import {
  Certificate as BasicCertificate,
  CoreProfile,
  JapaneseExistenceCertificate,
  JapaneseExistencePA,
  ProfileAnnotation,
  ProfileAnnotationIssuerRegistration,
  WebMediaProfile,
} from "@originator-profile/model";
import {
  JwtVcDecodingResult,
  JwtVcVerificationResult,
  UnverifiedJwtVc,
  VerifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import {
  CoreProfileNotFound,
  OpInvalid,
  OpsInvalid,
  OpsVerifyFailed,
  OpVerifyFailed,
} from "./errors";

/** @deprecated Profile Annotation とその派生として整理する可能性あるため "Certificate" の利用は非推奨 */
export type Certificate =
  | BasicCertificate
  | JapaneseExistenceCertificate
  | ProfileAnnotation
  | JapaneseExistencePA
  | ProfileAnnotationIssuerRegistration;

/** Originator Profile 復号失敗 */
export type OpDecodingFailure = {
  core: JwtVcDecodingResult<CoreProfile>;
  annotations?: JwtVcDecodingResult<Certificate>[];
  media?: JwtVcDecodingResult<WebMediaProfile>[];
};
/** 復号済み Originator Profile */
export type DecodedOp = {
  core: UnverifiedJwtVc<CoreProfile>;
  annotations?: UnverifiedJwtVc<Certificate>[];
  media?: UnverifiedJwtVc<WebMediaProfile>[];
};
/** Originator Profile 復号結果 */
export type OpDecodingResult = DecodedOp | OpInvalid;
/** Originator Profile Set 復号失敗 */
export type OpsDecodingFailure = OpDecodingResult[];

/** 復号済み Originator Profile Set */
export type DecodedOps = DecodedOp[];
/** Originator Profile Set 復号結果 */
export type OpsDecodingResult = DecodedOps | OpsInvalid;

/** Originator Profile 検証失敗 */
export type OpVerificationFailure = {
  core: JwtVcVerificationResult<CoreProfile> | CoreProfileNotFound<CoreProfile>;
  annotations?: (
    | JwtVcVerificationResult<Certificate>
    | CoreProfileNotFound<Certificate>
  )[];
  media?: (
    | JwtVcVerificationResult<WebMediaProfile>
    | CoreProfileNotFound<WebMediaProfile>
  )[];
};
/** 検証済み Originator Profile */
export type VerifiedOp = {
  core: VerifiedJwtVc<CoreProfile>;
  annotations?: VerifiedJwtVc<Certificate>[];
  media?: VerifiedJwtVc<WebMediaProfile>[];
};
/** Originator Profile 検証結果 */
export type OpVerificationResult = VerifiedOp | OpVerifyFailed;
/** Originator Profile Set 検証失敗 */
export type OpsVerificationFailure = OpVerificationResult[];

/** 検証済み Originator Profile Set */
export type VerifiedOps = VerifiedOp[];
/** Originator Profile Set 検証結果 */
export type OpsVerificationResult = VerifiedOps | OpsInvalid | OpsVerifyFailed;
