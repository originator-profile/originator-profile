import {
  CasVerifyFailed,
  OpsInvalid,
  OpsVerifier,
  OpsVerifyFailed,
  VerifiedOps,
  VerifiedSp,
  verifyCas,
} from "@originator-profile/verify";
import { useParams } from "react-router";
import useSWRImmutable from "swr/immutable";
import { getRegistryKeys } from "../../utils/get-registry-keys";
import { useSiteProfile } from "../siteProfile";
import { FrameIntegrityVerifier, fetchTabCredentials } from "./messaging";
import type {
  SupportedCa,
  SupportedVerifiedCas,
  FrameVerifiedCas,
} from "./types";

const CREDENTIALS_KEY = "credentials";

type FetchVerifiedCredentialsResult = {
  ops: VerifiedOps;
  cas: SupportedVerifiedCas;
  origin: string;
  url: string;
  framesCas: FrameVerifiedCas[];
};

/**
 * タブ内のクレデンシャルを取得して検証する。
 * @param tabId タブID
 * @returns 検証済みクレデンシャルおよびタブのorigin,url
 */
async function fetchVerifiedCredentials([, tabId, sp]: [
  _: typeof CREDENTIALS_KEY,
  tabId: number,
  sp?: VerifiedSp,
]): Promise<FetchVerifiedCredentialsResult> {
  const { frames, ...page } = await fetchTabCredentials(tabId);
  const verifiedSiteOps = sp?.originators ?? [];

  const [issuer, keys] = getRegistryKeys();
  const opsVerifier = OpsVerifier(
    [
      ...import.meta.env.REGISTRY_OPS,
      ...page.ops,
      ...frames.flatMap((frame) => frame.ops),
    ],
    keys,
    issuer,
  );

  const verifiedOps = await opsVerifier();
  if (
    verifiedOps instanceof OpsInvalid ||
    verifiedOps instanceof OpsVerifyFailed
  ) {
    throw verifiedOps;
  }
  verifiedOps.push(...verifiedSiteOps);
  const verifiedCasResults = await Promise.all(
    [page, ...frames].map(({ cas, ops: _, ...frame }) =>
      verifyCas<SupportedCa>(
        cas,
        verifiedOps,
        frame.url,
        FrameIntegrityVerifier(tabId, frame.frameId),
      ).then((result) => ({ result, frame })),
    ),
  );
  for (const { result } of verifiedCasResults) {
    if (result instanceof CasVerifyFailed) {
      throw result;
    }
  }
  return {
    ops: verifiedOps,
    cas: verifiedCasResults.flatMap(
      ({ result }) => result as SupportedVerifiedCas,
    ),
    origin: page.origin,
    url: page.url,
    framesCas: verifiedCasResults
      .slice(1) // page は除外
      .filter(({ result }) => Array.isArray(result) && result.length > 0)
      .map(({ result, frame }) => ({
        cas: result as SupportedVerifiedCas,
        ...frame,
      })),
  };
}

/**
 * Credentials 取得 (要 Base コンポーネント)
 */
export function useCredentials() {
  const params = useParams<{ tabId: string }>();
  const tabId = Number(params.tabId);
  const { siteProfile } = useSiteProfile();
  // TODO: 自動再検証する場合は取得エンドポイントが変わりうることをUIの振る舞いで考慮して
  const {
    data: credentials,
    error,
    isLoading,
  } = useSWRImmutable<
    FetchVerifiedCredentialsResult,
    Error,
    [typeof CREDENTIALS_KEY, number, VerifiedSp?]
  >([CREDENTIALS_KEY, tabId, siteProfile], fetchVerifiedCredentials);
  const { ops, cas, origin, framesCas } = credentials ?? {};

  return {
    cas,
    error,
    framesCas,
    isLoading,
    ops,
    origin,
    tabId,
  };
}
