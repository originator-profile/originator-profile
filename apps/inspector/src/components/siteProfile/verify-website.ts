import type { SiteProfile } from "@originator-profile/model";
import {
  SiteProfileFetchFailed,
  SiteProfileFetchInvalid,
  type FetchSiteProfileSuccess,
} from "@originator-profile/presentation";
import {
  toProblemDetails,
  verifyWebsite,
  type Logger,
  type ProblemDetails,
  type VerificationResult,
  type WebsiteOutcome,
} from "@originator-profile/verify";
import { codeOf } from "../../utils/problem-code";
import { getRegistry } from "../../utils/registry-ops";
import { fetchTabSiteProfile } from "./messaging";

/** タブが表示している Web サイトの検証結果 */
export type TabWebsiteVerification = {
  /** 検証結果 */
  result: VerificationResult<WebsiteOutcome>;
  /**
   * サイトが提示した Site Profile
   *
   * 文書の検証でも発信者を検証鍵に加えるため、取得した内容をそのまま返す。
   * 取得できなかった場合は undefined。
   */
  siteProfile?: SiteProfile;
};

/**
 * タブが表示している Web サイトを取得して検証する。
 * @param tabId タブID
 * @param options ロガー
 * @returns 検証結果と、取得した Site Profile
 */
export async function verifyTabWebsite(
  tabId: number,
  options: { logger?: Logger } = {},
): Promise<TabWebsiteVerification> {
  let data: FetchSiteProfileSuccess;
  try {
    data = await fetchTabSiteProfile(tabId);
  } catch (error) {
    return {
      result: {
        status: false,
        securingResults: [],
        warnings: [],
        info: [],
        errors: [toProblemDetails(error)],
      },
    };
  }

  const registry = await getRegistry();

  return {
    result: await verifyWebsite(data.origin, {
      siteProfile: data.result,
      registry,
      ...options,
    }),
    siteProfile: data.result,
  };
}

/**
 * Site Profile の取得に失敗したことを表す問題か。
 *
 * Site Profile 未設置はこれに該当する。検証の失敗とは区別する。
 */
export function isSiteProfileFetchError(problem?: ProblemDetails): boolean {
  const code = problem && codeOf(problem.type);
  return (
    code === SiteProfileFetchFailed.code ||
    code === SiteProfileFetchInvalid.code
  );
}
