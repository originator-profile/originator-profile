import type { ProblemDetails } from "@originator-profile/verify";
import { codeOf } from "./problem-code";

/**
 * 検証結果の問題を Error に戻す
 *
 * NOTE: to-legacy-result.ts 専用の移行用ヘルパー。同時に削除する。
 */
export function toError(problem?: ProblemDetails): Error {
  return Object.assign(new Error(problem?.title ?? "Verification failed"), {
    code: problem && codeOf(problem.type),
  });
}
