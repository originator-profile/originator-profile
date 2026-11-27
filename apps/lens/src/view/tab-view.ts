import { selectByLocale } from "@originator-profile/core";
import {
  isSiteProfileFetchError,
  isTopFrameUnreachable,
  type FrameVerification,
  type RegistryEntry,
  type SubscribedTabVerification,
  type VerificationEntry,
} from "@originator-profile/extension-common";
import type { WebsiteProfile } from "@originator-profile/model";
import type {
  OriginatorPayload,
  VerificationResult,
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
      /** 運営者がメインのコンテンツの提供者と同じなので、サイト名だけを提示する */
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
  | {
      state: "ready";
      tabId: number;
      site: SiteView;
      /** 検証に成功した文書のコンテンツ */
      contents: Content[];
      /** CA 発行者ごとの組織。発行者を確認できないものは含まない */
      issuers: Map<string, Organization>;
      /** 検証に成功した発信者。PA 発行者の組織を引くのに用いる */
      originators: OriginatorPayload[];
      /** Site Profile かトップレベル文書の検証に失敗したか、結果が無効になった */
      failed: boolean;
    };

type Settled = Extract<VerificationEntry, { state: "settled" }>;

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

/**
 * 文書の検証の状態
 * @returns 成功していればその結果、失敗か無効なら null、確定していなければ undefined
 */
function documentOf(entry?: VerificationEntry): Settled | null | undefined {
  if (entry?.state === "invalidated") return null;
  if (entry?.state !== "settled") return undefined;
  return entry.result.status ? entry : null;
}

/** Web サイトの検証の状態 */
type SiteState =
  | {
      state: "verified";
      sites: WebsiteProfile[];
      /** Site Profile の検証に用いた発信者 */
      originators: OriginatorPayload[];
    }
  /** Site Profile を置いていないか、取得できなかった */
  | { state: "absent" }
  /** 検証に失敗したか、結果が無効になった */
  | { state: "failed" };

/**
 * Web サイトの検証の状態を得る
 * @returns 確定していなければ undefined
 */
function siteStateOf(
  subscribed: SubscribedTabVerification,
): SiteState | undefined {
  const entry = subscribed.verification?.siteProfile;
  if (!entry || entry.state === "verifying") return undefined;
  if (entry.state === "invalidated") return { state: "failed" };
  const { result } = entry;
  if (result.status) {
    return {
      state: "verified",
      sites: result.outcome.sites.filter(
        (s): s is WebsiteProfile => s !== null,
      ),
      originators: result.outcome.originators,
    };
  }
  return isSiteProfileFetchError(result.errors[0])
    ? { state: "absent" }
    : { state: "failed" };
}

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
  site: SiteState,
  originators: OriginatorPayload[],
  contents: Content[],
): SiteView {
  const wsp = selectByLocale(site.state === "verified" ? site.sites : []);
  if (!wsp) return { state: "absent" };
  const name = wsp.credentialSubject.name;

  const main = contents.find((content) => content.main);
  if (main?.issuer === wsp.issuer) return { state: "same-as-main", name };

  const operator = organizationOf(wsp.issuer, originators);
  return operator ? { state: "present", name, operator } : { state: "absent" };
}

/** CA 発行者ごとの組織 */
const issuersOf = (contents: Content[], originators: OriginatorPayload[]) =>
  new Map(
    [...new Set(contents.map(({ issuer }) => issuer))].flatMap((issuer) => {
      const organization = organizationOf(issuer, originators);
      return organization ? [[issuer, organization] as const] : [];
    }),
  );

/** 文書ごとの検証の状態。トップレベル文書を先頭とする */
type Documents = ReturnType<typeof documentOf>[];

/**
 * 提示が揃うまで待つか
 *
 * NOTE: 共有の発信者 (レジストリ) は文書の結果より後に届くことがあるため、
 * 文書を提示できるときは揃うまで待つ
 */
const isLoading = (
  site: SiteState | undefined,
  frames: FrameVerification[],
  documents: Documents,
  registry: RegistryEntry | undefined,
) =>
  site === undefined ||
  frames[0]?.frame.frameType !== "outermost_frame" ||
  documents[0] === undefined ||
  (documents.some(Boolean) && registry === undefined);

/** 検証に成功した文書のコンテンツ。メインはトップレベル文書のものに限る */
const contentsOfDocuments = (documents: Documents) =>
  contentsOf(
    documents.flatMap((document, index) =>
      document?.result.status
        ? [
            {
              frame: document.subject,
              cas: document.result.outcome.cas.map(({ main, attestation }) => ({
                main: index === 0 && main,
                attestation,
              })),
            },
          ]
        : [],
    ),
  );

function readyOf(
  tabId: number,
  site: SiteState,
  documents: Documents,
  registry: RegistryEntry | undefined,
): TabView {
  const originators = [
    ...originatorsOf([
      registry,
      ...documents.map((document) => document?.result),
    ]),
    ...(site.state === "verified" ? site.originators : []),
  ];
  const contents = contentsOfDocuments(documents);
  return {
    state: "ready",
    tabId,
    site: siteOf(site, originators, contents),
    contents,
    issuers: issuersOf(contents, originators),
    originators,
    failed: site.state === "failed" || documents[0] === null,
  };
}

/**
 * タブの検証の状態から、表示を得る
 *
 * 文書ごとに、検証に成功した文書のコンテンツだけを提示する。失敗した文書や
 * 結果が無効になった文書は、無いものとして扱う。メインのコンテンツは
 * トップレベル文書のものに限り、サブフレームのメインは他のコンテンツと同じに扱う。
 * Site Profile も、検証に失敗したか結果が無効になれば無いものとして扱う。
 * @param tabId タブID
 * @param subscribed タブの検証の状態
 */
export function tabViewOf(
  tabId: number,
  subscribed: SubscribedTabVerification,
): TabView {
  if (isTopFrameUnreachable(subscribed)) {
    return readyOf(tabId, { state: "absent" }, [], undefined);
  }
  const site = siteStateOf(subscribed);
  const frames = subscribed.reachable ? presentedFrames(subscribed) : [];
  const documents = frames.map(({ entry }) => documentOf(entry));
  const registry = subscribed.verification?.registry;
  if (site === undefined || isLoading(site, frames, documents, registry)) {
    const entry = frames[0]?.entry;
    const origin =
      entry?.state === "settled" ? entry.subject.origin : undefined;
    return { state: "loading", origin };
  }
  return readyOf(tabId, site, documents, registry);
}
