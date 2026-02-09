export class FetchIntegrityFailed extends Error {
  static get code() {
    return "ERR_VERIFY_INTEGRITY_FAILED" as const;
  }
  readonly code = FetchIntegrityFailed.code;
  readonly ok = false;

  /** 取得結果 */
  result: {
    error?: Error;
    payload?: unknown;
  };

  constructor(message: string, result: FetchIntegrityFailed["result"]) {
    super(message);
    this.result = result;
  }
}
