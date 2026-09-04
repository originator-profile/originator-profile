import { problemType, ProblemType } from "./problem-types";
import type { ProblemDetails } from "./types";

const hasCode = (error: Error): error is Error & { code: string } =>
  "code" in error && typeof error.code === "string";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** 検証パッケージのエラーは、失敗した対象を result に保持する */
const innerErrorOf = (error: Error): Error | undefined => {
  if (error.cause instanceof Error) return error.cause;
  const result = "result" in error ? error.result : undefined;
  return isObject(result) && result.error instanceof Error
    ? result.error
    : undefined;
};

/**
 * エラーを {@link ProblemDetails} に変換する
 *
 * 検証パッケージのエラークラスは `code` (`ERR_*`) を持つため、それを
 * エラーリファレンスの URL に対応させて `type` とする。内側のエラー
 * (JOSE の失敗理由やスキーマ検証の issue) は `detail` に載せる。
 *
 * @param error 変換対象
 * @param at 問題を検出した位置を指す JSONPath
 * @returns 問題の詳細
 */
export function toProblemDetails(error: unknown, at?: string): ProblemDetails {
  const pointer = at ? { pointer: at } : {};

  if (!(error instanceof Error)) {
    return { type: ProblemType.Unspecified, title: String(error), ...pointer };
  }

  const type = hasCode(error)
    ? problemType(error.code)
    : ProblemType.Unspecified;
  const inner = innerErrorOf(error);

  return inner
    ? { type, title: error.message, detail: inner.message, ...pointer }
    : { type, title: error.message, ...pointer };
}
