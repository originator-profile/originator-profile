import { deserializeIfError } from "@originator-profile/core";
import {
  FetchIntegrityResult,
  VerifyIntegrity,
} from "@originator-profile/verify";
import { FetchCredentialsMessagingFailed } from "./errors";
import { credentialsMessenger } from "./events";
import { FrameCredentials, FrameResponse, TabCredentials } from "./types";

/**
 * タブ内の各フレームでクレデンシャルを取得する。
 * @param frames フレームのリスト
 * @param tabId タブID
 * @returns 結果の配列
 */
async function fetchAllFramesCredentials(
  frames: chrome.webNavigation.GetAllFrameResultDetails[],
  tabId: number,
): Promise<FrameCredentials[]> {
  const results: PromiseSettledResult<FrameCredentials>[] =
    await Promise.allSettled(
      frames.map(async (frame): Promise<FrameCredentials> => {
        const frameResponse: FrameResponse = {
          frameId: frame.frameId,
          parentFrameId: frame.parentFrameId,
        };
        const result = await credentialsMessenger.sendMessage(
          "fetchCredentials",
          null,
          {
            tabId,
            frameId: frame.frameId,
          },
        );
        if (result instanceof Error) {
          throw new FetchCredentialsMessagingFailed(
            "Fetch frame credentials error occured",
            {
              error: result,
              ...frameResponse,
            },
          );
        }

        const opsResult = deserializeIfError(result.ops);
        const casResult = deserializeIfError(result.cas);

        return {
          ops: opsResult instanceof Error ? [] : opsResult,
          cas: casResult instanceof Error ? [] : casResult,
          opMeta: result.opMeta,
          url: result.url,
          origin: result.origin,
          ...frameResponse,
        };
      }),
    );

  const errors = results.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );
  errors.forEach(({ reason }) => {
    console.error(reason);
  });

  const responses = results
    .filter(
      (r): r is PromiseFulfilledResult<FrameCredentials> =>
        r.status === "fulfilled",
    )
    .map(({ value }) => value);

  if (responses.length === 0) {
    const error = errors[0]?.reason;
    throw Object.assign(new Error(error.message), error);
  }
  return responses;
}

/**
 * タブ内のクレデンシャルを取得する。
 * @param tabId タブID
 * @returns クレデンシャルおよびタブのorigin,url
 */
export async function fetchTabCredentials(
  tabId: number,
): Promise<TabCredentials> {
  const frames = (await chrome.webNavigation.getAllFrames({ tabId })) ?? [];
  const frameCredentials = await fetchAllFramesCredentials(frames, tabId);

  const topLevelFrameIndex = frames.findIndex(
    (frame) => frame.parentFrameId === -1,
  );
  if (topLevelFrameIndex === -1) {
    throw Error("No response from top level frame");
  }
  const [topLevelFrameCredentials] = frameCredentials.splice(
    topLevelFrameIndex,
    1,
  );
  if (!topLevelFrameCredentials) {
    throw Error("No response from top level frame");
  }

  return {
    ...topLevelFrameCredentials,
    frames: frameCredentials,
  };
}

/**
 * フレーム内 Target Integrity 検証器
 * @param tabId タブID
 * @param frameId フレームID
 * @returns フレーム内 Target Integrity 検証器
 */
export const FrameIntegrityVerifier =
  (tabId: number, frameId: number): VerifyIntegrity =>
  async (content) => {
    const messageResult = await credentialsMessenger.sendMessage(
      "verifyIntegrity",
      content,
      {
        tabId,
        frameId,
      },
    );

    const parsed = deserializeIfError(messageResult);
    return parsed as FetchIntegrityResult;
  };

/**
 * リンク検証結果を取得する
 */
export const fetchVerificationResult = (tabId: number) =>
  credentialsMessenger.sendMessage("getVerificationResult", tabId);
