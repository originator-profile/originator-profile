import type { OpMeta } from "@originator-profile/model";
import type { CredentialSource } from "@originator-profile/presentation";
import type {
  DocumentOutcome,
  DocumentVerificationMetadata,
  InputDependency,
  OriginatorsOutcome,
  ProblemDetails,
  VerificationResult,
  VerificationTarget,
  WebsiteOutcome,
} from "@originator-profile/verify";
import type {
  FrameDocument,
  FrameLocation,
  FrameResponse,
} from "../credentials/types";

/** 検証対象の文書の識別 */
export type VerificationSubject = FrameResponse &
  Pick<FrameDocument, "documentId" | "frameType"> &
  FrameLocation & { tabId: number };

/**
 * 文書から取得したクレデンシャルの取得経路
 *
 * 原文は保持しない。結果の `$.originators[i]` / `$.cas[j]` は、それぞれ
 * `ops[i]` / `cas[j]` から取得したものを指す。
 */
export type DocumentCredentials = {
  ops: { source: CredentialSource }[];
  cas: { source: CredentialSource }[];
  opMeta?: OpMeta;
};

/**
 * 保持する文書の検証結果
 *
 * 検証対象 (verifyIntegrity を持つ) は保持できないため outcome から除く。
 * 検証対象の識別は {@link VerificationSubject} が担う。
 */
export type DocumentVerificationResult = VerificationResult<
  Omit<DocumentOutcome<VerificationTarget>, "target">
> &
  DocumentVerificationMetadata;

/** 取得経路ごとのクレデンシャルの同一性 */
export type ResourceIdentity = {
  source: CredentialSource;
  /** 取得した内容の SHA-256 ダイジェスト (base64) */
  digest: string;
};

/**
 * 入力同一性の判定手段
 *
 * Document の同一性は documentId (保持のキー)、Site Profile の発信者は
 * トップレベル文書ごとに 1 度だけ取得する Site Profile の検証結果、
 * レジストリは拡張機能に同梱されたものがそれぞれ担う。
 */
export type InputIdentity = {
  cas: ResourceIdentity[];
  ops: ResourceIdentity[];
  /** target ごとの入力依存対象 */
  targets: { pointer: string; dependency: InputDependency }[];
  /** allowedUrl の評価に用いた document's URL */
  evaluatedUrl: string;
};

/** 確定した検証結果 */
type Settled = {
  subject: VerificationSubject;
  credentials: DocumentCredentials;
  result: DocumentVerificationResult;
  inputIdentity: InputIdentity;
};

/**
 * 保持している文書の検証の状態
 *
 * - `unverified`: 検証を開始していない
 * - `verifying`: 検証を開始したが結果が確定していない
 * - `settled`: 検証済みまたは検証失敗。どちらかは `result.status` で判別する
 * - `invalidated`: 確定した結果が入力の変化または時刻経過によって有効でなくなった
 */
export type VerificationEntry =
  | { state: "unverified"; subject: VerificationSubject }
  | { state: "verifying"; subject: VerificationSubject; startedAt: string }
  | ({ state: "settled" } & Settled)
  | ({
      state: "invalidated";
      invalidatedAt: string;
      reason: ProblemDetails;
    } & Settled);

/**
 * オリジンの Site Profile の検証結果
 *
 * 同じオリジンのトップレベル文書のあいだで再利用する。発信者は Site Profile
 * の発信者だけを含み、レジストリの発信者は {@link RegistryEntry} が持つ。
 */
export type SiteProfileEntry = {
  /** Site Profile を探索したオリジン */
  origin: string;
  result: VerificationResult<WebsiteOutcome>;
};

/** レジストリの検証結果 */
export type RegistryEntry = VerificationResult<OriginatorsOutcome>;

/** フレームに読み込まれている文書と、その検証の状態 */
export type FrameVerification = {
  frame: chrome.webNavigation.GetAllFrameResultDetails;
  /** まだ検証の通知を受けていない文書では undefined */
  entry?: VerificationEntry;
};

/** タブが表示している文書群の検証の状態 */
export type TabVerification = {
  /** フレームごとの検証の状態。getAllFrames の順 */
  frames: FrameVerification[];
  /** トップレベル文書のオリジンの Site Profile の検証結果 */
  siteProfile?: SiteProfileEntry;
  /** レジストリの検証結果 */
  registry?: RegistryEntry;
};
