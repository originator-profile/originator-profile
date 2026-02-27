import {
  CasVerifyFailed,
  OpsInvalid,
  OpsVerifyFailed,
  VerifiedOps,
  VerifiedSp,
} from "@originator-profile/verify";
import { useParams } from "react-router";
import useSWRImmutable from "swr/immutable";
import { useSiteProfile } from "../siteProfile";
import { deduplicateCas } from "./deduplicate-cas";
import { fetchTabCredentials } from "./messaging";
import type { FramesVerifiedCas, SupportedVerifiedCas } from "./types";
import { verifyFramesCas, verifyOps } from "./verify-credentials";

const CREDENTIALS_KEY = "credentials";

type FetchVerifiedCredentialsResult = {
  ops: VerifiedOps;
  cas: SupportedVerifiedCas;
  origin: string;
  url: string;
  framesCas: FramesVerifiedCas;
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

  // OPS 検証
  const verifiedOps = await verifyOps(page, frames, sp);
  if (
    verifiedOps instanceof OpsInvalid ||
    verifiedOps instanceof OpsVerifyFailed
  ) {
    throw verifiedOps;
  }

  // CAS 検証
  const casResults = await verifyFramesCas(
    tabId,
    [page, ...frames],
    verifiedOps,
  );
  for (const { result } of casResults) {
    if (result instanceof CasVerifyFailed) {
      throw result;
    }
  }

  return {
    ops: verifiedOps,
    cas: deduplicateCas(
      casResults.flatMap(({ result }) => result as SupportedVerifiedCas),
    ),
    origin: page.origin,
    url: page.url,
    framesCas: casResults.map(({ result, frame }) => ({
      cas: result as SupportedVerifiedCas,
      url: frame.url,
      origin: frame.origin,
      frameId: frame.frameId,
      parentFrameId: frame.parentFrameId,
    })),
  };
}

type UseCredentialsResult =
  | {
      cas: undefined;
      error: undefined;
      framesCas: undefined;
      isLoading: true;
      ops: undefined;
      origin: undefined;
      tabId: number;
    }
  | {
      cas: undefined;
      error: Error;
      framesCas: undefined;
      isLoading: false;
      ops: undefined;
      origin: undefined;
      tabId: number;
    }
  | {
      cas: SupportedVerifiedCas;
      error: undefined;
      framesCas: FramesVerifiedCas;
      isLoading: false;
      ops: VerifiedOps;
      origin: string;
      tabId: number;
    };

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
  } as UseCredentialsResult;
}
