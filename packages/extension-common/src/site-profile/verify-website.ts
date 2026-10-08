import {
  SiteProfileFetchFailed,
  SiteProfileFetchInvalid,
  type FetchSiteProfileSuccess,
} from "@originator-profile/presentation";
import {
  toProblemDetails,
  verifyWebsite,
  type Logger,
  type OriginatorsOutcome,
  type ProblemDetails,
  type VerificationResult,
  type WebsiteOutcome,
} from "@originator-profile/verify";
import { codeOf } from "../utils/problem-code";
import { getRegistry } from "../utils/registry-ops";

/**
 * Site Profile を取得して Web サイトを検証する。
 * @param fetchSiteProfile Site Profile の取得
 * @param options レジストリの検証結果・ロガー
 * @returns 検証結果。取得に失敗した場合はその理由を errors に持つ
 */
export async function verifyFetchedWebsite(
  fetchSiteProfile: () => Promise<FetchSiteProfileSuccess>,
  options: {
    verifiedRegistry?: VerificationResult<OriginatorsOutcome>;
    logger?: Logger;
  } = {},
): Promise<VerificationResult<WebsiteOutcome>> {
  let data: FetchSiteProfileSuccess;
  try {
    data = await fetchSiteProfile();
  } catch (error) {
    return {
      status: false,
      securingResults: [],
      warnings: [],
      info: [],
      errors: [toProblemDetails(error)],
    };
  }

  return verifyWebsite(data.origin, {
    siteProfile: data.result,
    registry: await getRegistry(),
    ...options,
  });
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
