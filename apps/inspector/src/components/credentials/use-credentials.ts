import { VerifiedSp } from "@originator-profile/verify";
import { useParams } from "react-router";
import useSWRImmutable from "swr/immutable";
import { useSiteProfile } from "../siteProfile";
import { fetchTabCredentials, fetchVerificationResult } from "./messaging";
import type {
  FramesVerifiedCas,
  SupportedVerifiedCasWithSource,
  VerifiedOpsWithSource,
} from "./types";
import { verifyAllCredentials } from "./verify-credentials";

const CREDENTIALS_KEY = "credentials";

type FetchVerifiedCredentialsResult = {
  ops: VerifiedOpsWithSource;
  cas: SupportedVerifiedCasWithSource;
  origin: string;
  url: string;
  framesCas: FramesVerifiedCas;
  warnings: string[];
  info: string[];
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
  const result = await verifyAllCredentials(tabId, page, frames, sp);

  if (result instanceof Error) {
    throw result;
  }

  return {
    ops: result.ops,
    cas: result.cas,
    origin: page.origin,
    url: page.url,
    framesCas: result.casResults.map(({ result: cas, frame }) => ({
      cas: cas as SupportedVerifiedCasWithSource,
      url: frame.url,
      origin: frame.origin,
      frameId: frame.frameId,
      parentFrameId: frame.parentFrameId,
    })),
    warnings: result.warnings,
    info: result.info,
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
      warnings: undefined;
      info: undefined;
    }
  | {
      cas: undefined;
      error: Error;
      framesCas: undefined;
      isLoading: false;
      ops: undefined;
      origin: undefined;
      tabId: number;
      warnings: undefined;
      info: undefined;
    }
  | {
      cas: SupportedVerifiedCasWithSource;
      error: undefined;
      framesCas: FramesVerifiedCas;
      isLoading: false;
      ops: VerifiedOpsWithSource;
      origin: string;
      tabId: number;
      warnings: string[];
      info: string[];
    };

/**
 * Credentials 取得 (要 Base コンポーネント)
 */
export function useCredentials() {
  const params = useParams<{ tabId: string }>();
  const tabId = Number(params.tabId);
  const { siteProfile } = useSiteProfile();
  const {
    data: credentials,
    error,
    isLoading,
  } = useSWRImmutable<
    FetchVerifiedCredentialsResult,
    Error,
    [typeof CREDENTIALS_KEY, number, VerifiedSp?]
  >([CREDENTIALS_KEY, tabId, siteProfile], fetchVerifiedCredentials);
  const { ops, cas, origin, framesCas, warnings, info } = credentials ?? {};

  return {
    cas,
    error,
    framesCas,
    isLoading,
    ops,
    origin,
    tabId,
    warnings,
    info,
  } as UseCredentialsResult;
}

export { fetchVerificationResult };
