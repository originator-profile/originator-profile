import type { Logger } from "@originator-profile/verify";

/** 収集先を備えたロガー */
export type CollectingLogger = {
  logger: Logger;
  warnings: string[];
  info: string[];
};

/**
 * 検証中の警告・情報を収集するロガーを作成する。
 * コンソールへの出力は維持する。
 */
export function createCollectingLogger(): CollectingLogger {
  const warnings: string[] = [];
  const info: string[] = [];

  return {
    logger: {
      warn: (message) => {
        console.warn(message);
        warnings.push(message);
      },
      info: (message) => {
        console.info(message);
        info.push(message);
      },
    },
    warnings,
    info,
  };
}
