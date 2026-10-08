import type {
  DocumentOutcome,
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
>;

/**
 * 保持している文書の検証の状態
 *
 * - `unverified`: 検証を開始していない
 * - `verifying`: 検証を開始したが結果が確定していない
 * - `settled`: 検証済みまたは検証失敗。どちらかは `result.status` で判別する
 */
export type VerificationEntry =
  | { state: "unverified"; subject: VerificationSubject }
  | { state: "verifying"; subject: VerificationSubject; startedAt: string }
  | {
      state: "settled";
      subject: VerificationSubject;
      credentials: DocumentCredentials;
      result: DocumentVerificationResult;
    };

/** トップレベル文書のオリジンの Site Profile の検証結果 */
export type SiteProfileEntry = TabWebsiteVerification & {
  /** 検証したトップレベル文書 */
  documentId: string;
};
