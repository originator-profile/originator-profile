import { VerifiedSp } from "@originator-profile/verify";
import { useParams } from "react-router";
import useSWRImmutable from "swr/immutable";
import { createCollectingLogger } from "../../utils/collecting-logger";
import { verifyTabWebsite } from "./verify-website";

const key = "site-profile";

type FetchVerifiedSiteProfileResult = {
  siteProfile: VerifiedSp;
  warnings: string[];
  info: string[];
};

async function fetchVerifiedSiteProfile([, tabId]: [
  _: typeof key,
  tabId: number,
]): Promise<FetchVerifiedSiteProfileResult> {
  const { logger, warnings, info } = createCollectingLogger();
  const siteProfile = await verifyTabWebsite(tabId, { logger });

  return { siteProfile, warnings, info };
}

/**
 * Site Profile 取得 (要 Base コンポーネント)
 */
export function useSiteProfile() {
  const params = useParams<{ tabId: string }>();
  const tabId = Number(params.tabId);
  const { data, error, isLoading } = useSWRImmutable<
    FetchVerifiedSiteProfileResult,
    Error,
    [typeof key, number]
  >([key, tabId], fetchVerifiedSiteProfile, {
    // NOTE: 404 だと再試行しつづけるのを抑制する目的
    shouldRetryOnError: false,
  });
  return {
    error,
    isLoading,
    siteProfile: data?.siteProfile,
    tabId,
    warnings: data?.warnings,
    info: data?.info,
  };
}
