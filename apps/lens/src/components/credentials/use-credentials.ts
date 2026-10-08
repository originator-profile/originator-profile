import {
  deduplicateCas,
  fetchTabCredentials,
  FrameIntegrityVerifier,
  getRegistry,
  registrySource,
  siteProfileSource,
  type FramesVerifiedCas,
  type OpOrigin,
  type SupportedVerifiedCasWithSource,
  type VerifiedOpsWithSource,
} from "@originator-profile/extension-common";
import type { OriginatorProfileSet } from "@originator-profile/model";
import { verifyDocument } from "@originator-profile/verify";
import { useParams } from "react-router";
import useSWRImmutable from "swr/immutable";
import { toLegacyDocument } from "../../utils/to-legacy-result";
import { useSiteProfile } from "../siteProfile";

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
  const results = await Promise.all(
    framesAndPage.map((frame) =>
      verifyDocument(
        {
          ...frame,
          ops: frame.ops.map(({ credential }) => credential),
          cas: frame.cas.map(({ credential }) => credential),
          verifyIntegrity: FrameIntegrityVerifier(tabId, frame.frameId),
        },
        { registry, siteOriginators: websiteOriginators },
      ),
    ),
  );

  const documents = results.map((result, i) => {
    const frame = framesAndPage[i];
    if (!frame) {
      throw new Error(`framesAndPage[${i}] not found`);
    }
    const legacy = toLegacyDocument(result);
    if (legacy instanceof Error) {
      throw legacy;
    }
    return { frame, result, legacy };
  });

  // NOTE: verifyDocument はレジストリ・(トップレベル文書なら) Web サイト・文書の
  // OPS をこの順で1本の配列にまとめて検証し、legacy.ops は入力と同じ順序・件数で
  // 返る契約になっている (packages/verify/src/originator-profile-set/verify-ops.ts
  // 参照)。取得元(source)の対応付けはこの順序を前提に行う。レジストリと Web
  // サイトの発信者は文書ごとに同じものが現れるため、最初の文書の分だけを残す。
  const sharedSources = (frame: (typeof framesAndPage)[number]): OpOrigin[] => [
    ...registry.ops.map(registrySource),
    ...(frame.frameType === "outermost_frame"
      ? (websiteOriginators ?? []).map(siteProfileSource)
      : []),
  ];
  /** 2つ目以降の文書で、レジストリ・Web サイトの発信者を指す通知か */
  const isRepeated = (i: number, shared: number, at?: string) => {
    const index = at?.match(/^\$\.originators\[(\d+)\]/)?.[1];
    return i > 0 && index !== undefined && Number(index) < shared;
  };

  const ops: VerifiedOpsWithSource = documents.flatMap(
    ({ frame, legacy }, i) => {
      const shared = sharedSources(frame);
      const sources = [...shared, ...frame.ops.map(({ source }) => source)];
      return legacy.ops.flatMap((op, j) => {
        if (i > 0 && j < shared.length) return [];
        const source = sources[j];
        if (!source) {
          throw new Error(`sources[${j}] not found`);
        }
        return [{ ...op, source }];
      });
    },
  );

  const problems = (key: "warnings" | "info") =>
    documents.flatMap(({ frame, result }, i) => {
      const shared = sharedSources(frame).length;
      return result[key].flatMap(({ title, pointer: at }) =>
        isRepeated(i, shared, at) ? [] : [title],
      );
    });

  const framesCas = documents.map(({ frame, legacy }) => ({
    // NOTE: verifyCas も同様に入力(frame.cas)と同じ順序・件数で返す契約
    // (packages/verify/src/content-attestation-set/verify-cas.ts 参照)。
    cas: legacy.cas.map((c, j) => {
      const sourced = frame.cas[j];
      if (!sourced) {
        throw new Error(`frame.cas[${j}] not found`);
      }
      return { ...c, source: sourced.source };
    }) as SupportedVerifiedCasWithSource,
    url: frame.url,
    origin: frame.origin,
    frameId: frame.frameId,
    parentFrameId: frame.parentFrameId,
    frameType: frame.frameType,
  }));

  return {
    ops,
    cas: deduplicateCas(framesCas.flatMap(({ cas }) => cas)),
    origin: page.origin,
    url: page.url,
    framesCas,
    warnings: problems("warnings"),
    info: problems("info"),
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
