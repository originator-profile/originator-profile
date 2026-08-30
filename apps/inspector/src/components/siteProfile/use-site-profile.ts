import {
  type Logger,
  SpVerifier,
  VerifiedSp,
} from "@originator-profile/verify";
import { useParams } from "react-router";
import useSWRImmutable from "swr/immutable";
import { getRegistryOps } from "../../utils/registry-ops";
import { fetchTabSiteProfile } from "./messaging";

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
  const data = await fetchTabSiteProfile(tabId);
  const {
    ops: registryOps,
    keys: [cpIssuer, verificationKeys],
  } = await getRegistryOps();

  // 検証中の警告・情報を収集する (コンソールへの出力は維持)
  const warnings: string[] = [];
  const info: string[] = [];
  const logger: Logger = {
    warn: (message) => {
      console.warn(message);
      warnings.push(message);
    },
    info: (message) => {
      console.info(message);
      info.push(message);
    },
  };

  const verifySp = SpVerifier(
    {
      ...data.result,
      originators: [...registryOps, ...data.result.originators],
    },
    verificationKeys,
    cpIssuer,
    data.origin,
    { logger },
  );

  const verifiedSp = await verifySp();
  if (verifiedSp instanceof Error) {
    throw verifiedSp;
  }
  return { siteProfile: verifiedSp, warnings, info };
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
