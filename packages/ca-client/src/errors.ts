export const CaClientErrorCode = {
  Config: "CA_CONFIG",
  Validation: "CA_VALIDATION",
  Http: "CA_HTTP",
  Response: "CA_RESPONSE",
  File: "CA_FILE",
} as const;

export type CaClientErrorCode =
  (typeof CaClientErrorCode)[keyof typeof CaClientErrorCode];

export class CaClientError extends Error {
  readonly code: CaClientErrorCode;
  readonly status?: number;

  constructor(
    message: string,
    options: {
      code: CaClientErrorCode;
      cause?: unknown;
      status?: number;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "CaClientError";
    this.code = options.code;
    this.status = options.status;
  }
}

/** True when the request failed with HTTP 401. */
export const isUnauthorized = (error: unknown): boolean =>
  error instanceof CaClientError &&
  error.code === CaClientErrorCode.Http &&
  error.status === 401;
