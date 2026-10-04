import { SpVerificationFailure } from "./types";

export class SiteProfileInvalid extends Error {
  static get code() {
    return "ERR_SITE_PROFILE_INVALID" as const;
  }
  readonly code = SiteProfileInvalid.code;

  constructor(
    message: string,
    public result: SpVerificationFailure,
  ) {
    super(message);
  }
}

export class SiteProfileVerifyFailed extends Error {
  static get code() {
    return "ERR_SITE_PROFILE_VERIFY_FAILED" as const;
  }
  readonly code = SiteProfileVerifyFailed.code;

  constructor(
    message: string,
    public result: SpVerificationFailure,
  ) {
    super(message);
  }
}
