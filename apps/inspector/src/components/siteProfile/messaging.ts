import { deserializeIfError } from "@originator-profile/core";
import { type FetchSiteProfileSuccess } from "@originator-profile/presentation";
import { siteProfileMessenger } from "./events";

/**
 * タブ内のサイトプロファイルを取得する。
 * @param tabId タブID
 * @returns サイトプロファイル
 */
export async function fetchTabSiteProfile(
  tabId: number,
): Promise<FetchSiteProfileSuccess> {
  const result = await siteProfileMessenger.sendMessage(
    "fetchSiteProfile",
    null,
    tabId,
  );

  const parsed = deserializeIfError(result);
  if (parsed instanceof Error) {
    throw parsed;
  }

  return parsed;
}
