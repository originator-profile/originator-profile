import type { OriginatorProfileSet } from "@originator-profile/model";
import type { VerifiedSp } from "@originator-profile/verify";
import { useParams } from "react-router";
import useSWRImmutable from "swr/immutable";
import { toLegacyWebsite } from "../../utils/to-legacy-result";
import { verifyTabWebsite } from "./verify-website";

const key = "site-profile";

type FetchVerifiedSiteProfileResult = {
  siteProfile: VerifiedSp;
  /** 文書の検証で検証鍵に加えるための、サイトが提示した発信者 */
  originators: OriginatorProfileSet;
  warnings: string[];
  info: string[];
};

async function fetchVerifiedSiteProfile([, tabId]: [
  _: typeof key,
  tabId: number,
]): Promise<FetchVerifiedSiteProfileResult> {
  const { result, siteProfile } = await verifyTabWebsite(tabId);
  const legacy = toLegacyWebsite(result);
  if (legacy instanceof Error) {
    throw legacy;
  }

  return {
    siteProfile: legacy,
    originators: siteProfile?.originators ?? [],
    warnings: result.warnings.map(({ title }) => title),
    info: result.info.map(({ title }) => title),
  };
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
    originators: data?.originators,
    tabId,
    warnings: data?.warnings,
    info: data?.info,
  };
}
