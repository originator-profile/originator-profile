import { SpVerifier, VerifiedSp } from "@originator-profile/verify";
import { useParams } from "react-router";
import useSWRImmutable from "swr/immutable";
import { getCpIssuerKeys, getCpIssuerOps } from "../../utils/cp-issuer-ops";
import { fetchTabSiteProfile } from "./messaging";

const key = "site-profile";

async function fetchVerifiedSiteProfile([, tabId]: [
  _: typeof key,
  tabId: number,
]): Promise<VerifiedSp> {
  const [data, [issuer, verificationKey], cpIssuerOps] = await Promise.all([
    fetchTabSiteProfile(tabId),
    getCpIssuerKeys(),
    getCpIssuerOps(),
  ]);

  const verifySp = SpVerifier(
    {
      ...data.result,
      originators: [...cpIssuerOps, ...data.result.originators],
    },
    verificationKey,
    issuer,
    data.origin,
  );

  const verifiedSp = await verifySp();
  if (verifiedSp instanceof Error) {
    throw verifiedSp;
  }
  return verifiedSp;
}

/**
 * Site Profile 取得 (要 Base コンポーネント)
 */
export function useSiteProfile() {
  const params = useParams<{ tabId: string }>();
  const tabId = Number(params.tabId);
  const { data, error, isLoading } = useSWRImmutable<
    VerifiedSp,
    Error,
    [typeof key, number]
  >([key, tabId], fetchVerifiedSiteProfile, {
    // NOTE: 404 だと再試行しつづけるのを抑制する目的
    shouldRetryOnError: false,
  });
  return {
    error,
    isLoading,
    siteProfile: data,
    tabId,
  };
}
