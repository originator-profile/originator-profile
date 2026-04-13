export class IntegrityFetchFailed extends Error {
  static get code() {
    return "ERR_INTEGRITY_FETCH_FAILED" as const;
  }
  readonly code = IntegrityFetchFailed.code;
  readonly ok = false;

  /** 取得結果 */
  result?: Error;

  constructor(message: string, result: IntegrityFetchFailed["result"]) {
    super(message);
    this.result = result;
  }
}

export class IntegrityVerificationFailed extends Error {
  static get code() {
    return "ERR_INTEGRITY_VERIFICATION_FAILED" as const;
  }
  readonly code = IntegrityVerificationFailed.code;
  readonly ok = false;

  /** 取得結果 */
  result?: unknown;

  constructor(message: string, result: IntegrityVerificationFailed["result"]) {
    super(message);
    this.result = result;
  }
}
