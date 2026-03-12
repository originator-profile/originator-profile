import type { SchemaIssue } from "@originator-profile/securing-mechanism";
import { JWTPayload } from "jose";
import { JOSEError } from "jose/errors";
import { DecodeResult, VerifyTokenResult } from "./types";

export type { SchemaIssue };

export class ProfileGenericError extends Error {
  static get code() {
    return "ERR_PROFILE_GENERIC";
  }
  readonly code = ProfileGenericError.code;
}

export class ProfileClaimsValidationFailed extends ProfileGenericError {
  static get code() {
    return "ERR_PROFILE_CLAIMS_VALIDATION_FAILED" as const;
  }
  readonly code = ProfileClaimsValidationFailed.code;

  /** 復号結果 */
  result: {
    error?: JOSEError;
    errors?: SchemaIssue[];
    payload?: JWTPayload;
    jwt: string;
  };

  constructor(
    message: string,
    result: ProfileClaimsValidationFailed["result"],
  ) {
    super(message);
    this.result = result;
  }
}

export class ProfileTokenVerifyFailed extends ProfileGenericError {
  static get code() {
    return "ERR_PROFILE_TOKEN_VERIFY_FAILED" as const;
  }
  readonly code = ProfileTokenVerifyFailed.code;

  /** 検証結果 */
  result: Exclude<DecodeResult, ProfileGenericError> & {
    error?: JOSEError;
  };

  constructor(message: string, result: ProfileTokenVerifyFailed["result"]) {
    super(message);
    this.result = result;
  }
}

export class ProfileBodyExtractFailed extends ProfileGenericError {
  static get code() {
    return "ERR_PROFILE_BODY_EXTRACT_FAILED" as const;
  }
  readonly code = ProfileBodyExtractFailed.code;
}

export class ProfileBodyVerifyFailed extends ProfileGenericError {
  static get code() {
    return "ERR_PROFILE_BODY_VERIFY_FAILED" as const;
  }
  readonly code = ProfileBodyVerifyFailed.code;

  /** 検証結果 */
  result: {
    error?: JOSEError;
    body: string;
  };

  constructor(message: string, result: ProfileBodyVerifyFailed["result"]) {
    super(message);
    this.result = result;
  }
}

export class ProfilesResolveFailed extends ProfileGenericError {
  static get code() {
    return "ERR_PROFILES_RESOLVE_FAILED" as const;
  }
  readonly code = ProfilesResolveFailed.code;

  /** 検証結果 */
  result: Exclude<DecodeResult, ProfileGenericError>;

  constructor(message: string, result: ProfilesResolveFailed["result"]) {
    super(message);
    this.result = result;
  }
}

export class ProfilesVerifyFailed extends ProfileGenericError {
  static get code() {
    return "ERR_PROFILES_VERIFY_FAILED" as const;
  }
  readonly code = ProfilesVerifyFailed.code;

  /** 検証結果 */
  result: Exclude<DecodeResult | VerifyTokenResult, ProfileGenericError>;

  constructor(message: string, result: ProfilesVerifyFailed["result"]) {
    super(message);
    this.result = result;
  }
}

export class CertificationSystemValidationFailed extends ProfileGenericError {
  static get code() {
    return "ERR_CERTIFICATION_SYSTEM_VALIDATION_FAILED" as const;
  }
  readonly code = CertificationSystemValidationFailed.code;

  /** 検証結果 */
  result: {
    payload?: unknown;
  };

  constructor(
    message: string,
    result: CertificationSystemValidationFailed["result"],
  ) {
    super(message);
    this.result = result;
  }
}
