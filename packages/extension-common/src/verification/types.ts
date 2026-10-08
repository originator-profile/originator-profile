import type { CredentialSource } from "@originator-profile/presentation";
import type {
  DocumentOutcome,
  DocumentVerificationMetadata,
  InputDependency,
  ProblemDetails,
  VerificationResult,
  VerificationTarget,
} from "@originator-profile/verify";
import type {
  FrameCredentials,
  FrameDocument,
  FrameLocation,
  FrameResponse,
} from "../credentials/types";
import type { TabWebsiteVerification } from "../site-profile/verify-website";

/** 検証対象の文書の識別 */
export type VerificationSubject = FrameResponse &
  Pick<FrameDocument, "documentId" | "frameType"> &
  FrameLocation & { tabId: number };

/** 文書から取得したクレデンシャル */
export type DocumentCredentials = Pick<
  FrameCredentials,
  "ops" | "cas" | "opMeta"
>;

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

/** トップレベル文書のオリジンの Site Profile の検証結果 */
export type SiteProfileEntry = TabWebsiteVerification & {
  /** 検証したトップレベル文書 */
  documentId: string;
};
