import {
  VerifiedOps,
  VerifiedSp,
  verifyDocuments,
} from "@originator-profile/verify";
import { useParams } from "react-router";
import useSWRImmutable from "swr/immutable";
import { createCollectingLogger } from "../../utils/collecting-logger";
import { getRegistry } from "../../utils/registry-ops";
import { useSiteProfile } from "../siteProfile";
import { deduplicateCas } from "./deduplicate-cas";
import {
  fetchTabCredentials,
  fetchVerificationResult,
  FrameIntegrityVerifier,
} from "./messaging";
import type {
  FramesVerifiedCas,
  SupportedCa,
  SupportedVerifiedCas,
} from "./types";

const CREDENTIALS_KEY = "credentials";

type FetchVerifiedCredentialsResult = {
  ops: VerifiedOps;
  cas: SupportedVerifiedCas;
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
  const { logger, warnings, info } = createCollectingLogger();
  const [registry, { frames, ...page }] = await Promise.all([
    getRegistry(),
    fetchTabCredentials(tabId),
  ]);

  const targets = [page, ...frames].map((frame) => ({
    ...frame,
    verifyIntegrity: FrameIntegrityVerifier(tabId, frame.frameId),
  }));

  const result = await verifyDocuments<SupportedCa, (typeof targets)[number]>(
    targets,
    { registry, website: sp, logger },
  );

  if (result instanceof Error) {
    throw result;
  }

  return {
    ops: result.originators,
    cas: deduplicateCas(result.documents.flatMap(({ cas }) => cas)),
    origin: page.origin,
    url: page.url,
    framesCas: result.documents.map(({ target, cas }) => ({
      cas,
      url: target.url,
      origin: target.origin,
      frameId: target.frameId,
      parentFrameId: target.parentFrameId,
    })),
    warnings,
    info,
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
      cas: SupportedVerifiedCas;
      error: undefined;
      framesCas: FramesVerifiedCas;
      isLoading: false;
      ops: VerifiedOps;
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
