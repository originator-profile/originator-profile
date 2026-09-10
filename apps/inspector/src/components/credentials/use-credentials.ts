import type { OriginatorProfileSet } from "@originator-profile/model";
import { verifyDocuments } from "@originator-profile/verify";
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
import {
  registrySource,
  siteProfileSource,
  type FramesVerifiedCas,
  type OpOrigin,
  type SupportedVerifiedCasWithSource,
  type VerifiedOpsWithSource,
} from "./types";

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
async function fetchVerifiedCredentials([, tabId, websiteOriginators]: [
  _: typeof CREDENTIALS_KEY,
  tabId: number,
  websiteOriginators?: OriginatorProfileSet,
]): Promise<FetchVerifiedCredentialsResult> {
  const [registry, { frames, ...page }] = await Promise.all([
    getRegistry(),
    fetchTabCredentials(tabId),
  ]);

  const framesAndPage = [page, ...frames];
  const targets = framesAndPage.map((frame) => ({
    ...frame,
    ops: frame.ops.map(({ credential }) => credential),
    cas: frame.cas.map(({ credential }) => credential),
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

  // NOTE: verifyDocuments はレジストリ・Web サイト・各文書の OPS をこの順で
  // 1本の配列にまとめて検証するため(packages/verify/src/document/verify-documents.ts
  // 参照)、legacy.ops は入力と同じ順序・件数で返る契約になっている
  // (packages/verify/src/originator-profile-set/verify-ops.ts 参照)。
  // 取得元(source)の対応付けはこの順序を前提に行う。
  const opsSources: OpOrigin[] = [
    ...registry.ops.map(registrySource),
    ...(websiteOriginators ?? []).map(siteProfileSource),
    ...framesAndPage.flatMap((frame) =>
      frame.ops.map(({ source }) => source),
    ),
  ];
  const ops: VerifiedOpsWithSource = legacy.ops.map((op, i) => {
    const source = opsSources[i];
    if (!source) {
      throw new Error(`opsSources[${i}] not found`);
    }
    return { ...op, source };
  });

  const documents = legacy.documents.map(({ target, cas }, i) => {
    const frame = framesAndPage[i];
    if (!frame) {
      throw new Error(`framesAndPage[${i}] not found`);
    }
    // NOTE: verifyCas も同様に入力(frame.cas)と同じ順序・件数で返す契約
    // (packages/verify/src/content-attestation-set/verify-cas.ts 参照)。
    return {
      target,
      cas: cas.map((c, j) => {
        const sourced = frame.cas[j];
        if (!sourced) {
          throw new Error(`frame.cas[${j}] not found`);
        }
        return { ...c, source: sourced.source };
      }) as SupportedVerifiedCasWithSource,
    };
  });

  return {
    ops,
    cas: deduplicateCas(
      documents.flatMap(({ cas }) => cas),
    ),
    origin: page.origin,
    url: page.url,
    framesCas: documents.map(({ target, cas }) => ({
      cas,
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
