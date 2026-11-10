import { selectByLocale } from "@originator-profile/core";
import {
  isTopFrameUnreachable,
  VerificationInvalidated,
  type FrameVerification,
  type SubscribedTabVerification,
  type VerificationEntry,
} from "@originator-profile/extension-common";
import { codeOf } from "@originator-profile/extension-common/utils/problem-code";
import type { WebsiteProfile } from "@originator-profile/model";
import {
  CasVerifyFailed,
  OpsVerifyFailed,
  SiteProfileInvalid,
  SiteProfileVerifyFailed,
  type OriginatorPayload,
  type ProblemDetails,
  type VerificationResult,
} from "@originator-profile/verify";
import { contentsOf, type Content } from "./contents";
import { organizationOf, type Organization } from "./organization";

/** Web サイトの運営者の提示のしかた */
export type SiteView =
  | {
      /** 運営者を提示する */
      state: "present";
      name: string;
      operator: Organization;
    }
  | {
      /** 運営者がメインのコンテンツの作成者と同じなので、サイト名だけを提示する */
      state: "same-as-main";
      name: string;
    }
  | {
      /** 運営者を確認できない */
      state: "absent";
    };

/** タブの表示 */
export type TabView =
  | { state: "loading"; origin?: string }
  /** 発信者の詐称やコンテンツの改竄のおそれがある */
  | { state: "prohibited" }
  /** OP に対応していない。codes は理由のエラーコード (不明なら undefined) */
  | { state: "unsupported"; codes: (string | undefined)[] }
  | {
      state: "ready";
      site: SiteView;
      contents: Content[];
      /** CA 発行者ごとの組織。発行者を確認できないものは含まない */
      issuers: Map<string, Organization>;
    };

type Settled = Extract<VerificationEntry, { state: "settled" }>;

/** 失敗の理由。成功していれば null、確定していなければ undefined */
type Failure = { code?: string } | null | undefined;

const problemCode = (problem?: ProblemDetails) =>
  problem && codeOf(problem.type);

const failureOf = (result: VerificationResult<unknown>): Failure =>
  result.status ? null : { code: problemCode(result.errors[0]) };

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
function presentedFrames(subscribed: SubscribedTabVerification) {
  const frames = (subscribed.verification?.frames ?? []).filter(
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

/** 文書群の検証の状態 */
type Documents = {
  /** 確定した文書。トップレベル文書を先頭とする */
  settled: Settled[];
  failure: Failure;
};

/**
 * 文書群の検証の状態を得る
 *
 * NOTE: 共有の発信者の検証に失敗していれば文書の検証も失敗している。失敗は
 * 文書の結果から読み、共有の発信者の失敗を文書の失敗として扱わない
 */
function documentsOf(subscribed: SubscribedTabVerification): Documents {
  if (isTopFrameUnreachable(subscribed)) return { settled: [], failure: {} };
  const frames = subscribed.reachable ? presentedFrames(subscribed) : [];
  if (frames[0]?.frame.frameType !== "outermost_frame") {
    return { settled: [], failure: undefined };
  }

  const entries = frames.map(({ entry }) => entry);
  if (entries.some((entry) => entry?.state === "invalidated")) {
    return { settled: [], failure: { code: VerificationInvalidated.code } };
  }
  if (!entries.every(isSettled)) return { settled: [], failure: undefined };
  const failure =
    entries.map(({ result }) => failureOf(result)).find(Boolean) ?? null;
  return { settled: entries, failure };
}

/**
 * Web サイトの検証の状態
 * @returns 確定していなければ undefined
 */
function siteFailureOf(subscribed: SubscribedTabVerification): Failure {
  if (isTopFrameUnreachable(subscribed)) return {};
  const entry = subscribed.verification?.siteProfile;
  if (!entry || entry.state === "verifying") return undefined;
  if (entry.state === "invalidated") {
    return { code: VerificationInvalidated.code };
  }
  return failureOf(entry.result);
}

/**
 * トップレベル文書の検証に用いた共有の発信者が揃っているか
 *
 * 文書の結果より後に届くことがあるため、揃うまで提示を待つ。
 */
function sharedReady(top: Settled, subscribed: SubscribedTabVerification) {
  const usesSiteProfile = top.result.inputRange.some(
    ({ kind }) => kind === "site-profile",
  );
  const site = subscribed.verification?.siteProfile;
  return (
    subscribed.verification?.registry !== undefined &&
    (!usesSiteProfile || (site !== undefined && site.state !== "verifying"))
  );
}

const isSiteProhibited = (failure: Failure) =>
  !!failure &&
  (failure.code === SiteProfileVerifyFailed.code ||
    failure.code === SiteProfileInvalid.code);

const isDocumentProhibited = (failure: Failure) =>
  !!failure &&
  (failure.code === OpsVerifyFailed.code ||
    failure.code === CasVerifyFailed.code);

/** 検証に成功した結果の発信者を集める */
function originatorsOf(
  results: (
    | VerificationResult<{ originators: OriginatorPayload[] }>
    | undefined
  )[],
): OriginatorPayload[] {
  return results.flatMap((result) =>
    result?.status ? result.outcome.originators : [],
  );
}

function siteOf(
  subscribed: SubscribedTabVerification,
  originators: OriginatorPayload[],
  contents: Content[],
): SiteView {
  const entry = subscribed.verification?.siteProfile;
  const result = entry?.state === "settled" ? entry.result : undefined;
  const sites =
    result?.status === true
      ? result.outcome.sites.filter((s): s is WebsiteProfile => s !== null)
      : [];
  const wsp = selectByLocale(sites);
  if (!wsp) return { state: "absent" };
  const name = wsp.credentialSubject.name;

  const main = contents.find((content) => content.main);
  if (main?.issuer === wsp.issuer) return { state: "same-as-main", name };

  const operator = organizationOf(wsp.issuer, originators);
  return operator ? { state: "present", name, operator } : { state: "absent" };
}

/** 提示が揃うまで待つか */
function isLoading(
  subscribed: SubscribedTabVerification,
  siteFailure: Failure,
  { settled: [top], failure }: Documents,
) {
  return (
    siteFailure === undefined ||
    failure === undefined ||
    (top !== undefined && failure === null && !sharedReady(top, subscribed))
  );
}

/** 検証に成功した発信者とコンテンツ */
function verifiedOf(
  subscribed: SubscribedTabVerification,
  { settled, failure }: Documents,
) {
  const verified = failure === null ? settled : [];
  const site = subscribed.verification?.siteProfile;
  const originators = originatorsOf([
    subscribed.verification?.registry,
    site?.state === "settled" ? site.result : undefined,
    ...verified.map(({ result }) => result),
  ]);
  const contents = contentsOf(
    verified.map(({ subject, result }) => ({
      frame: subject,
      cas: result.status ? result.outcome.cas : [],
    })),
  );
  return { originators, contents };
}

/** CA 発行者ごとの組織 */
const issuersOf = (contents: Content[], originators: OriginatorPayload[]) =>
  new Map(
    [...new Set(contents.map(({ issuer }) => issuer))].flatMap((issuer) => {
      const organization = organizationOf(issuer, originators);
      return organization ? [[issuer, organization] as const] : [];
    }),
  );

/**
 * タブの検証の状態から、表示を得る
 *
 * 閲覧禁止と未対応の振り分けは次による。
 *
 * - Site Profile、OPS、CAS のいずれかの検証に失敗していれば閲覧禁止
 * - Site Profile か CA のいずれかを提示できれば表示する
 * - いずれも提示できなければ未対応とし、その理由を示す
 * @param subscribed タブの検証の状態
 */
export function tabViewOf(subscribed: SubscribedTabVerification): TabView {
  const siteFailure = siteFailureOf(subscribed);
  const documents = documentsOf(subscribed);
  if (isLoading(subscribed, siteFailure, documents)) {
    return { state: "loading", origin: documents.settled[0]?.subject.origin };
  }
  if (
    isSiteProhibited(siteFailure) ||
    isDocumentProhibited(documents.failure)
  ) {
    return { state: "prohibited" };
  }

  const { originators, contents } = verifiedOf(subscribed, documents);

  if (siteFailure !== null && contents.length === 0) {
    return {
      state: "unsupported",
      codes: [siteFailure, documents.failure]
        .filter((failure) => !!failure)
        .map(({ code }) => code),
    };
  }
  return {
    state: "ready",
    site: siteOf(subscribed, originators, contents),
    contents,
    issuers: issuersOf(contents, originators),
  };
}
