export const CaClientErrorCode = {
  Config: "CA_CONFIG",
  Auth: "CA_AUTH",
  Validation: "CA_VALIDATION",
  Http: "CA_HTTP",
  Response: "CA_RESPONSE",
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

/** True when the CA server rejected the request with HTTP 401 (not CCSP). */
export const isUnauthorized = (error: unknown): boolean =>
  error instanceof CaClientError &&
  error.code === CaClientErrorCode.Http &&
  error.status === 401;
