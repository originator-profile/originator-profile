import { deserializeIfError } from "@originator-profile/core";
import { SpVerifier, VerifiedSp } from "@originator-profile/verify";
import { useParams } from "react-router";
import useSWRImmutable from "swr/immutable";
import { getRegistryKeys } from "../../utils/get-registry-keys";
import { siteProfileMessenger } from "./events";

const key = "site-profile";

async function fetchVerifiedSiteProfile([, tabId]: [
  _: typeof key,
  tabId: number,
]): Promise<VerifiedSp> {
  const result = await siteProfileMessenger.sendMessage(
    "fetchSiteProfile",
    null,
    tabId,
  );

  // コンテントスクリプトからError型を返してもError型として取り扱ってくれない
  // そのためエラーだった場合エラー型に復元してくれるシリアライズ処理を行っているため
  // deserializeIfErrorにてエラー型として復元してやる
  const parsed = deserializeIfError(result);

  if (parsed instanceof Error) {
    throw parsed;
  }

  const [issuer, key] = getRegistryKeys();

  const verifySp = SpVerifier(
    {
      ...parsed.result,
      originators: [
        ...import.meta.env.REGISTRY_OPS,
        ...parsed.result.originators,
      ],
    },
    key,
    issuer,
    parsed.origin,
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
