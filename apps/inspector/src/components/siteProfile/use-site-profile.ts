import {
  SpVerifier,
  VerifiedSp,
  type WarnHandler,
} from "@originator-profile/verify";
import { useParams } from "react-router";
import useSWRImmutable from "swr/immutable";
import { getRegistryOps } from "../../utils/registry-ops";
import { fetchTabSiteProfile } from "./messaging";

const key = "site-profile";

type FetchVerifiedSiteProfileResult = {
  siteProfile: VerifiedSp;
  warnings: string[];
};

async function fetchVerifiedSiteProfile([, tabId]: [
  _: typeof key,
  tabId: number,
]): Promise<FetchVerifiedSiteProfileResult> {
  const data = await fetchTabSiteProfile(tabId);
  const {
    ops: registryOps,
    keys: [cpIssuer, verificationKeys],
  } = await getRegistryOps();

  // 検証中の警告を収集する (コンソールへの出力は維持)
  const warnings: string[] = [];
  const warn: WarnHandler = (message) => {
    console.warn(message);
    warnings.push(message);
  };

  const verifySp = SpVerifier(
    {
      ...data.result,
      originators: [...registryOps, ...data.result.originators],
    },
    verificationKeys,
    cpIssuer,
    data.origin,
    { warn },
  );

  const verifiedSp = await verifySp();
  if (verifiedSp instanceof Error) {
    throw verifiedSp;
  }
  return { siteProfile: verifiedSp, warnings };
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
  };
}
