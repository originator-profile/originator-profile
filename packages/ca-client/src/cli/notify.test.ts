import { expect, test } from "vitest";
import { notifyScriptFailure } from "./notify.ts";

const silentLogger = { log: () => {}, error: () => {} };

const actionsEnv = {
  GITHUB_SERVER_URL: "https://github.com",
  GITHUB_REPOSITORY: "originator-profile/originator-profile.org",
  GITHUB_RUN_ID: "123",
};

const postedText = async (
  failure: Parameters<typeof notifyScriptFailure>[0],
  env: Record<string, string | undefined>,
): Promise<string> => {
  const bodies: string[] = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    bodies.push(init.body as string);
    return new Response("ok", { status: 200 });
  }) as unknown as typeof fetch;
  await notifyScriptFailure(failure, {
    webhookUrl: "https://hooks.slack.test/xxx",
    fetchImpl,
    logger: silentLogger,
    env,
  });
  expect(bodies.length).toBe(1);
  return JSON.parse(bodies[0]).text;
};

test("notifyScriptFailure: webhookUrl 未設定なら送信しない", async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response("ok");
  }) as unknown as typeof fetch;

  await notifyScriptFailure(
    { source: "refresh-cas", error: new Error("boom") },
    { webhookUrl: undefined, fetchImpl, logger: silentLogger, env: {} },
  );

  expect(called).toBe(false);
});

test("notifyScriptFailure: webhookUrl があれば JSON を POST する", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response("ok", { status: 200 });
  }) as unknown as typeof fetch;

  await notifyScriptFailure(
    { source: "incremental-cas", error: new Error("生成に失敗") },
    {
      webhookUrl: "https://hooks.slack.test/xxx",
      fetchImpl,
      logger: silentLogger,
      env: actionsEnv,
    },
  );

  expect(calls.length).toBe(1);
  expect(calls[0].url).toBe("https://hooks.slack.test/xxx");
  expect(calls[0].init.method).toBe("POST");

  const body = JSON.parse(calls[0].init.body as string);
  expect(body.text).toMatch(/incremental-cas/);
  expect(body.text).toMatch(/生成に失敗/);
  expect(body.text).toMatch(
    /https:\/\/github\.com\/originator-profile\/originator-profile\.org\/actions\/runs\/123/,
  );
});

test("notifyScriptFailure: fetch が reject しても throw しない", async () => {
  const fetchImpl = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;

  await expect(
    notifyScriptFailure(
      { source: "reconcile-cas", error: new Error("boom") },
      {
        webhookUrl: "https://hooks.slack.test/xxx",
        fetchImpl,
        logger: silentLogger,
        env: {},
      },
    ),
  ).resolves.toBeUndefined();
});

test("notifyScriptFailure: Slack が 4xx を返しても throw しない", async () => {
  const fetchImpl = (async () =>
    new Response("invalid_payload", {
      status: 400,
    })) as unknown as typeof fetch;

  await expect(
    notifyScriptFailure(
      { source: "audit-news-cas", error: "文字列エラー" },
      {
        webhookUrl: "https://hooks.slack.test/xxx",
        fetchImpl,
        logger: silentLogger,
        env: {},
      },
    ),
  ).resolves.toBeUndefined();
});

test("notifyScriptFailure: Actions 変数が無ければ実行ログ行を出さない", async () => {
  const text = await postedText(
    { source: "refresh-cas", error: new Error("boom") },
    {},
  );

  expect(text).toMatch(/refresh-cas/);
  expect(text).toMatch(/boom/);
  expect(text).not.toMatch(/実行ログ/);
});

test("notifyScriptFailure: Error 以外の値も文字列化して載せる", async () => {
  const text = await postedText({ source: "refresh-cas", error: 42 }, {});

  expect(text).toMatch(/42/);
});
