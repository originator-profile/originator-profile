import type { ProblemDetails } from "@originator-profile/verify";

/**
 * 確定した検証結果が、入力の変化または時刻経過によって有効でなくなった
 *
 * 検証失敗とは区別して提示する。
 */
export class VerificationInvalidated extends Error {
  static get code() {
    return "ERR_VERIFICATION_INVALIDATED";
  }
  readonly code = VerificationInvalidated.code;

  constructor(
    message: string,
    public reason: ProblemDetails,
  ) {
    super(message);
  }
}
