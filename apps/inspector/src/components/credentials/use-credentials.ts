import {
  deduplicateCas,
  registrySource,
  siteProfileSource,
  VerificationInvalidated,
  type FramesVerifiedCas,
  type FrameVerification,
  type OpOrigin,
  type SiteProfileEntry,
  type SupportedVerifiedCasWithSource,
  type VerificationEntry,
  type VerifiedOpsWithSource,
} from "@originator-profile/extension-common";
import { useMemo } from "react";
import { useParams } from "react-router";
import {
  toLegacyDocument,
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

/** 検証に用いた Site Profile の発信者 */
const siteOriginatorsOf = (entry: Settled, site?: SiteProfileEntry) =>
  entry.result.inputRange.some(({ kind }) => kind === "site-profile")
    ? (site?.siteProfile?.originators ?? [])
    : [];

/**
 * 文書ごとの確定した検証結果を、表示に用いる形にまとめる
 * @param documents 確定した検証結果。トップレベル文書を先頭とする
 * @param site トップレベル文書のオリジンの Site Profile の検証結果
 */
function toVerifiedCredentials(
  documents: Settled[],
  site?: SiteProfileEntry,
): VerifiedCredentials | Error {
  const legacies: { entry: Settled; legacy: LegacyDocument }[] = [];
  for (const entry of documents) {
    const legacy = toLegacyDocument(entry.result);
    if (legacy instanceof Error) return legacy;
    legacies.push({ entry, legacy });
  }

  // NOTE: verifyDocument はレジストリ・(トップレベル文書なら) Web サイト・文書の
  // OPS をこの順で1本の配列にまとめて検証し、legacy.ops は入力と同じ順序・件数で
  // 返る契約になっている (packages/verify/src/originator-profile-set/verify-ops.ts
  // 参照)。取得元(source)の対応付けはこの順序を前提に行う。レジストリと Web
  // サイトの発信者は文書ごとに同じものが現れるため、最初の文書の分だけを残す。
  const sharedSources = ({ entry, legacy }: (typeof legacies)[number]) => {
    const siteSources = siteOriginatorsOf(entry, site).map(siteProfileSource);
    const registryCount =
      legacy.ops.length - entry.credentials.ops.length - siteSources.length;
    return [
      ...Array.from({ length: registryCount }, registrySource),
      ...siteSources,
    ];
  };
  /** 2つ目以降の文書で、レジストリ・Web サイトの発信者を指す通知か */
  const isRepeated = (i: number, shared: number, at?: string) => {
    const index = at?.match(/^\$\.originators\[(\d+)\]/)?.[1];
    return i > 0 && index !== undefined && Number(index) < shared;
  };

  const ops: VerifiedOpsWithSource = legacies.flatMap((document, i) => {
    const shared: OpOrigin[] = sharedSources(document);
    const sources = [
      ...shared,
      ...document.entry.credentials.ops.map(({ source }) => source),
    ];
    return document.legacy.ops.flatMap((op, j) => {
      if (i > 0 && j < shared.length) return [];
      const source = sources[j];
      if (!source) {
        throw new Error(`sources[${j}] not found`);
      }
      return [{ ...op, source }];
    });
  });

  const problems = (key: "warnings" | "info") =>
    legacies.flatMap((document, i) => {
      const shared = sharedSources(document).length;
      return document.entry.result[key].flatMap(({ title, pointer: at }) =>
        isRepeated(i, shared, at) ? [] : [title],
      );
    });

  const framesCas = legacies.map(({ entry, legacy }) => ({
    // NOTE: verifyCas も同様に入力(credentials.cas)と同じ順序・件数で返す契約
    // (packages/verify/src/content-attestation-set/verify-cas.ts 参照)。
    cas: legacy.cas.map((c, j) => {
      const sourced = entry.credentials.cas[j];
      if (!sourced) {
        throw new Error(`credentials.cas[${j}] not found`);
      }
      return { ...c, source: sourced.source };
    }) as SupportedVerifiedCasWithSource,
    url: entry.subject.url,
    origin: entry.subject.origin,
    frameId: entry.subject.frameId,
    parentFrameId: entry.subject.parentFrameId,
    frameType: entry.subject.frameType,
  }));

  const [top] = documents;
  return {
    ops,
    cas: deduplicateCas(framesCas.flatMap(({ cas }) => cas)),
    origin: top?.subject.origin ?? "",
    url: top?.subject.url ?? "",
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
  if (!entries.every((entry) => entry?.state === "settled")) return undefined;
  return toVerifiedCredentials(entries, snapshot.verification?.siteProfile);
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
