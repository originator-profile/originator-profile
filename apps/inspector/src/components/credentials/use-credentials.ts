import {
  deduplicateCas,
  registrySource,
  siteProfileSource,
  VerificationInvalidated,
  type FramesVerifiedCas,
  type FrameVerification,
  type RegistryEntry,
  type SiteProfileEntry,
  type SupportedVerifiedCasWithSource,
  type VerificationEntry,
  type VerifiedOpsWithSource,
} from "@originator-profile/extension-common";
import type { WebsiteVerificationResult } from "@originator-profile/verify";
import { useMemo } from "react";
import { useParams } from "react-router";
import {
  toLegacyDocument,
  toLegacyOriginators,
  type LegacyDocument,
} from "../../utils/to-legacy-result";
import {
  isTopFrameUnreachable,
  useTabVerification,
  type TabVerificationSnapshot,
} from "../activeTab/use-tab-verification";

type VerifiedCredentials = {
  ops: VerifiedOpsWithSource;
  cas: SupportedVerifiedCasWithSource;
  origin: string;
  url: string;
  framesCas: FramesVerifiedCas;
  warnings: string[];
  info: string[];
};

type Settled = Extract<VerificationEntry, { state: "settled" }>;

/** 結果の i 番目の要素の取得経路。結果は入力と同じ順序・件数で返る契約 */
function sourceAt<T>(sources: T[], i: number, label: string): T {
  const source = sources[i];
  if (!source) {
    throw new Error(`${label}[${i}] not found`);
  }
  return source;
}

type DocumentResult = { entry: Settled; legacy: LegacyDocument };

/** 文書ごとの検証結果を従来の形に戻す。いずれかが失敗していればそのエラー */
function toLegacies(documents: Settled[]): DocumentResult[] | Error {
  const legacies: DocumentResult[] = [];
  for (const entry of documents) {
    const legacy = toLegacyDocument(entry.result);
    if (legacy instanceof Error) return legacy;
    legacies.push({ entry, legacy });
  }
  return legacies;
}

/**
 * トップレベル文書の検証に用いた共有の発信者 (レジストリ、Web サイト) を、
 * 取得経路を付けて得る
 * @returns 検証結果が揃っていなければ undefined
 */
function sharedOriginatorsOf(
  top: Settled,
  registry?: RegistryEntry,
  site?: WebsiteVerificationResult,
) {
  const usesSiteProfile = top.result.inputRange.some(
    ({ kind }) => kind === "site-profile",
  );
  if (!registry || (usesSiteProfile && !site)) return undefined;

  const parts = [
    { result: registry, source: registrySource },
    ...(usesSiteProfile && site
      ? [{ result: site, source: siteProfileSource }]
      : []),
  ];
  const ops: VerifiedOpsWithSource = [];
  for (const { result, source } of parts) {
    const legacy = toLegacyOriginators(result);
    if (legacy instanceof Error) return legacy;
    ops.push(...legacy.map((op) => ({ ...op, source: source() })));
  }
  return { results: parts.map(({ result }) => result), ops };
}

/** 文書の発信者に、文書から取得したときの取得経路を付ける */
const documentOriginators = (legacies: DocumentResult[]) =>
  // NOTE: 文書の発信者は入力 (credentials.ops) と同じ順序・件数で返る契約
  // (packages/verify/src/originator-profile-set/verify-ops.ts 参照)
  legacies.flatMap(({ entry, legacy }) =>
    legacy.ops.map((op, j) => ({
      ...op,
      source: sourceAt(entry.credentials.ops, j, "credentials.ops").source,
    })),
  );

/** 文書ごとの Content Attestation に、取得経路とフレームの情報を付ける */
const framesCasOf = (legacies: DocumentResult[]): FramesVerifiedCas =>
  legacies.map(({ entry, legacy }) => ({
    // NOTE: verifyCas も同様に入力(credentials.cas)と同じ順序・件数で返す契約
    // (packages/verify/src/content-attestation-set/verify-cas.ts 参照)。
    cas: legacy.cas.map((c, j) => ({
      ...c,
      source: sourceAt(entry.credentials.cas, j, "credentials.cas").source,
    })) as SupportedVerifiedCasWithSource,
    url: entry.subject.url,
    origin: entry.subject.origin,
    frameId: entry.subject.frameId,
    parentFrameId: entry.subject.parentFrameId,
    frameType: entry.subject.frameType,
  }));

/**
 * 文書ごとの確定した検証結果を、表示に用いる形にまとめる
 *
 * 発信者は、トップレベル文書の検証に用いた共有の発信者 (レジストリ、Web サイト
 * の発信者の順) を先頭に、各文書の発信者を続けて並べる。
 * @param documents 確定した検証結果。トップレベル文書を先頭とする
 * @param registry レジストリの検証結果
 * @param site トップレベル文書のオリジンの Site Profile の検証結果
 * @returns 共有の発信者の検証結果が揃っていなければ undefined
 */
function toVerifiedCredentials(
  [top, ...rest]: [Settled, ...Settled[]],
  registry?: RegistryEntry,
  site?: WebsiteVerificationResult,
): VerifiedCredentials | Error | undefined {
  // NOTE: 共有の発信者の検証に失敗していれば文書の検証も失敗している。文書の
  // 失敗を先に返し、共有の発信者の失敗を文書の発信者の失敗として示さない
  const documents = [top, ...rest];
  const legacies = toLegacies(documents);
  if (legacies instanceof Error) return legacies;
  const shared = sharedOriginatorsOf(top, registry, site);
  if (!shared || shared instanceof Error) return shared;

  const problems = (key: "warnings" | "info") =>
    [...shared.results, ...documents.map(({ result }) => result)].flatMap(
      (result) => result[key].map(({ title }) => title),
    );
  const framesCas = framesCasOf(legacies);

  return {
    ops: [...shared.ops, ...documentOriginators(legacies)],
    cas: deduplicateCas(framesCas.flatMap(({ cas }) => cas)),
    origin: top.subject.origin,
    url: top.subject.url,
    framesCas,
    warnings: problems("warnings"),
    info: problems("info"),
  };
}

/**
 * 利用者に提示する文書。トップレベル文書を先頭とする
 *
 * 結果の確定した文書と、検証が始まっているトップレベル文書を含める。文書の結果は
 * 文書ごとに届くため、まだ確定していないサブフレームの文書は確定してから加わる。
 * content script の届かない文書 (拡張機能のページなど) は結果を持たないため含まれない。
 *
 * NOTE: fenced frame 中の CAS の検証結果を、埋め込み側の文書の検証結果に含めて
 * 提示してはならない
 */
function presentedFrames(snapshot: TabVerificationSnapshot) {
  const frames = (snapshot.verification?.frames ?? []).filter(
    ({ frame, entry }) =>
      frame.frameType !== "fenced_frame" &&
      (entry?.state === "settled" ||
        entry?.state === "invalidated" ||
        (frame.frameType === "outermost_frame" && entry !== undefined)),
  );
  const isTop = ({ frame }: FrameVerification) =>
    frame.frameType === "outermost_frame";
  return [...frames.filter(isTop), ...frames.filter((f) => !isTop(f))];
}

const isSettled = (entry?: VerificationEntry): entry is Settled =>
  entry?.state === "settled";

/** 文書の結果がすべて確定していれば、先頭を保ったまま返す */
function settledEntries(
  entries: (VerificationEntry | undefined)[],
): [Settled, ...Settled[]] | undefined {
  const [top, ...rest] = entries;
  if (!isSettled(top) || !rest.every(isSettled)) return undefined;
  return [top, ...rest];
}

/** Site Profile の検証結果。確定していなければ undefined */
const siteResultOf = (entry?: SiteProfileEntry) =>
  entry?.state === "verifying" ? undefined : entry?.result;

/**
 * タブの検証の状態から、表示に用いるクレデンシャルを得る
 * @returns 確定していない文書があれば undefined
 */
function toCredentialsView(
  snapshot: TabVerificationSnapshot,
): VerifiedCredentials | Error | undefined {
  if (isTopFrameUnreachable(snapshot)) {
    return new Error("No response from top level frame");
  }
  if (!snapshot.reachable) return undefined;
  const frames = presentedFrames(snapshot);
  if (frames[0]?.frame.frameType !== "outermost_frame") return undefined;

  const entries = frames.map(({ entry }) => entry);
  const invalidated = entries.find((entry) => entry?.state === "invalidated");
  if (invalidated?.state === "invalidated") {
    return new VerificationInvalidated(
      invalidated.reason.title,
      invalidated.reason,
    );
  }
  const settled = settledEntries(entries);
  if (!settled) return undefined;
  return toVerifiedCredentials(
    settled,
    snapshot.verification?.registry,
    siteResultOf(snapshot.verification?.siteProfile),
  );
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
  const snapshot = useTabVerification(tabId);
  const view = useMemo(() => toCredentialsView(snapshot), [snapshot]);
  const error = view instanceof Error ? view : undefined;
  const credentials = view instanceof Error ? undefined : view;
  const { ops, cas, origin, framesCas, warnings, info } = credentials ?? {};

  return {
    cas,
    error,
    framesCas,
    isLoading: view === undefined,
    ops,
    origin,
    tabId,
    warnings,
    info,
  } as UseCredentialsResult;
}
