import type { OriginatorProfileSet } from "@originator-profile/model";
import { verifyDocuments, type VerifiedOps } from "@originator-profile/verify";
import { useParams } from "react-router";
import useSWRImmutable from "swr/immutable";
import { getRegistry } from "../../utils/registry-ops";
import { toLegacyDocuments } from "../../utils/to-legacy-result";
import { useSiteProfile } from "../siteProfile";
import { deduplicateCas } from "./deduplicate-cas";
import {
  fetchTabCredentials,
  fetchVerificationResult,
  FrameIntegrityVerifier,
} from "./messaging";
import type { FramesVerifiedCas, SupportedVerifiedCas } from "./types";

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
async function fetchVerifiedCredentials([, tabId, websiteOriginators]: [
  _: typeof CREDENTIALS_KEY,
  tabId: number,
  websiteOriginators?: OriginatorProfileSet,
]): Promise<FetchVerifiedCredentialsResult> {
  const [registry, { frames, ...page }] = await Promise.all([
    getRegistry(),
    fetchTabCredentials(tabId),
  ]);

  const targets = [page, ...frames].map((frame) => ({
    ...frame,
    verifyIntegrity: FrameIntegrityVerifier(tabId, frame.frameId),
  }));

  const result = await verifyDocuments(targets, {
    registry,
    websiteOriginators,
  });

  const legacy = toLegacyDocuments(result);
  if (legacy instanceof Error) {
    throw legacy;
  }

  return {
    ops: legacy.ops,
    cas: deduplicateCas(
      legacy.documents.flatMap(({ cas }) => cas),
    ) as SupportedVerifiedCas,
    origin: page.origin,
    url: page.url,
    framesCas: legacy.documents.map(({ target, cas }) => ({
      cas: cas as SupportedVerifiedCas,
      url: target.url,
      origin: target.origin,
      frameId: target.frameId,
      parentFrameId: target.parentFrameId,
    })),
    warnings: result.warnings.map(({ title }) => title),
    info: result.info.map(({ title }) => title),
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
  const { originators } = useSiteProfile();
  const {
    data: credentials,
    error,
    isLoading,
  } = useSWRImmutable<
    FetchVerifiedCredentialsResult,
    Error,
    [typeof CREDENTIALS_KEY, number, OriginatorProfileSet?]
  >([CREDENTIALS_KEY, tabId, originators], fetchVerifiedCredentials);
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
