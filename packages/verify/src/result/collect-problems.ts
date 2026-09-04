import type { Logger } from "../logger";
import { ProblemType } from "./problem-types";
import type { ProblemDetails } from "./types";

/** 収集先を備えたロガー */
export type ProblemCollector = {
  logger: Logger;
  warnings: ProblemDetails[];
  info: ProblemDetails[];
};

/** 種類が特定されていない通知 */
const unspecified = (title: string): ProblemDetails => ({
  type: ProblemType.Unspecified,
  title,
});

/**
 * 検証中の通知を収集するロガーを作成する
 *
 * 構造化された `details` を伴わない通知は、メッセージ文字列のみを持つ
 * {@link ProblemDetails} として収集する。
 *
 * @param delegate 収集と併せて通知を委譲する先 (デフォルト: `console`)
 * @returns 収集先を備えたロガー
 */
export function collectProblems(delegate: Logger = console): ProblemCollector {
  const warnings: ProblemDetails[] = [];
  const info: ProblemDetails[] = [];

  return {
    logger: {
      warn(message, details) {
        delegate.warn(message);
        warnings.push(details ?? unspecified(message));
      },
      info(message, details) {
        delegate.info(message);
        info.push(details ?? unspecified(message));
      },
    },
    warnings,
    info,
  };
}
