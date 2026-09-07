export class FetchFailed extends Error {
  static get code() {
    return "ERR_FETCH_FAILED" as const;
  }
  readonly code = FetchFailed.code;
  readonly ok = false;

  error: Error;

  constructor(message: string, error: Error) {
    super(message);
    this.error = error;
  }
}

/** DocumentProvider が扱えない Target */
export class UnsupportedDocumentTarget extends Error {
  static get code() {
    return "ERR_UNSUPPORTED_DOCUMENT_TARGET" as const;
  }
  readonly code = UnsupportedDocumentTarget.code;
}
