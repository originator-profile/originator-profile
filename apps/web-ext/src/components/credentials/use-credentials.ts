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
import { FrameCredentials, SupportedCa, SupportedVerifiedCas } from "./types";

const CREDENTIALS_KEY = "credentials";

type FetchVerifiedCredentialsResult = {
  ops: VerifiedOps;
  cas: SupportedVerifiedCas;
  origin: string;
  url: string;
  frames: FrameCredentials[];
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
    [page, ...frames].map((frame) =>
      verifyCas<SupportedCa>(
        frame.cas,
        verifiedOps,
        frame.url,
        FrameIntegrityVerifier(tabId, frame.frameId),
      ),
    ),
  );
  for (const verifiedCas of verifiedCasResults) {
    if (verifiedCas instanceof CasVerifyFailed) {
      throw verifiedCas;
    }
  }
  return {
    ops: verifiedOps,
    cas: verifiedCasResults.flat() as SupportedVerifiedCas,
    origin: page.origin,
    url: page.url,
    frames,
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
  const { ops, cas, origin, frames } = credentials ?? {};

  return {
    cas,
    error,
    frames,
    isLoading,
    ops,
    origin,
    tabId,
  };
}
