const DEFAULT_TIMEOUT_MS = 5000;

type SlackNotifyDependencies = {
  webhookUrl: string | undefined;
  fetchImpl: typeof fetch;
  logger: Pick<Console, "log" | "error">;
  env: Record<string, string | undefined>;
  timeoutMs: number;
};

const defaultDependencies = (): SlackNotifyDependencies => ({
  webhookUrl: process.env.SLACK_WEBHOOK_URL,
  fetchImpl: fetch,
  logger: console,
  env: process.env,
  timeoutMs: DEFAULT_TIMEOUT_MS,
});

export type ScriptFailure = {
  source: string;
  error: unknown;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const runUrl = (env: SlackNotifyDependencies["env"]): string | undefined => {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = env;
  if (!GITHUB_SERVER_URL || !GITHUB_REPOSITORY || !GITHUB_RUN_ID) {
    return undefined;
  }
  return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
};

const failureText = (
  failure: ScriptFailure,
  env: SlackNotifyDependencies["env"],
): string => {
  const lines = [
    `🚨 CAS 処理が失敗しました: ${failure.source}`,
    `エラー: ${errorMessage(failure.error)}`,
  ];
  const url = runUrl(env);
  if (url) lines.push(`実行ログ: ${url}`);
  return lines.join("\n");
};

export const notifyScriptFailure = async (
  failure: ScriptFailure,
  dependencies: Partial<SlackNotifyDependencies> = {},
): Promise<void> => {
  const deps = { ...defaultDependencies(), ...dependencies };

  if (!deps.webhookUrl) {
    deps.logger.log(
      "SLACK_WEBHOOK_URL が未設定のため Slack 通知はスキップしました。",
    );
    return;
  }

  try {
    const response = await deps.fetchImpl(deps.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: failureText(failure, deps.env) }),
      signal: AbortSignal.timeout(deps.timeoutMs),
    });

    if (!response.ok) {
      deps.logger.error(
        `Slack 通知に失敗しました (status: ${response.status})。処理は続行します。`,
      );
      return;
    }

    deps.logger.log("Slack にエラーを通知しました。");
  } catch (notifyError) {
    deps.logger.error(
      "Slack 通知の送信中にエラーが発生しました。処理は続行します:",
      notifyError,
    );
  }
};
