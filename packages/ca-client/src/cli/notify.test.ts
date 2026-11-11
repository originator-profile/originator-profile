import assert from "node:assert/strict";
import { test } from "vitest";
import { notifyScriptFailure } from "./notify";

const silentLogger = { log: () => {}, error: () => {} };

const actionsEnv = {
  GITHUB_SERVER_URL: "https://github.com",
  GITHUB_REPOSITORY: "originator-profile/originator-profile.org",
  GITHUB_RUN_ID: "123",
};

const bodyText = (body: RequestInit["body"]): string => {
  if (typeof body === "string") {
    return body;
  }
  throw new Error("expected a string body");
};

const postedText = async (
  failure: Parameters<typeof notifyScriptFailure>[0],
  env: Record<string, string | undefined>,
): Promise<string> => {
  const bodies: string[] = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    bodies.push(bodyText(init.body));
    return new Response("ok", { status: 200 });
  }) as unknown as typeof fetch;
  await notifyScriptFailure(failure, {
    webhookUrl: "https://hooks.slack.test/xxx",
    fetchImpl,
    logger: silentLogger,
    env,
  });
  assert.equal(bodies.length, 1);
  const body = bodies[0];
  if (body === undefined) {
    throw new Error("expected a Slack body");
  }
  return JSON.parse(body).text;
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

  assert.equal(called, false);
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

  assert.equal(calls.length, 1);
  const call = calls[0];
  if (call === undefined) {
    throw new Error("expected a Slack request");
  }
  assert.equal(call.url, "https://hooks.slack.test/xxx");
  assert.equal(call.init.method, "POST");

  const body = JSON.parse(bodyText(call.init.body));
  assert.match(body.text, /incremental-cas/);
  assert.match(body.text, /生成に失敗/);
  assert.match(
    body.text,
    /https:\/\/github\.com\/originator-profile\/originator-profile\.org\/actions\/runs\/123/,
  );
});

test("notifyScriptFailure: fetch が reject しても throw しない", async () => {
  const fetchImpl = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;

  await assert.doesNotReject(() =>
    notifyScriptFailure(
      { source: "reconcile-cas", error: new Error("boom") },
      {
        webhookUrl: "https://hooks.slack.test/xxx",
        fetchImpl,
        logger: silentLogger,
        env: {},
      },
    ),
  );
});

test("notifyScriptFailure: Slack が 4xx を返しても throw しない", async () => {
  const fetchImpl = (async () =>
    new Response("invalid_payload", {
      status: 400,
    })) as unknown as typeof fetch;

  await assert.doesNotReject(() =>
    notifyScriptFailure(
      { source: "audit-news-cas", error: "文字列エラー" },
      {
        webhookUrl: "https://hooks.slack.test/xxx",
        fetchImpl,
        logger: silentLogger,
        env: {},
      },
    ),
  );
});

test("notifyScriptFailure: Actions 変数が無ければ実行ログ行を出さない", async () => {
  const text = await postedText(
    { source: "refresh-cas", error: new Error("boom") },
    {},
  );

  assert.match(text, /refresh-cas/);
  assert.match(text, /boom/);
  assert.doesNotMatch(text, /実行ログ/);
});

test("notifyScriptFailure: Error 以外の値も文字列化して載せる", async () => {
  const text = await postedText({ source: "refresh-cas", error: 42 }, {});

  assert.match(text, /42/);
});
