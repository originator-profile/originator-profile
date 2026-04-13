import type { WarningSearchParams } from "../../utils/warning-params";
import type { LinkVerificationResult } from "../credentials/types";

/** 広告リンク検証の共通コンテキスト情報 */
export interface VerificationContext {
  /** 検証対象の Originator Profile ID */
  targetOpId: string;
  /** 広告元の組織名 */
  sourceOrgName?: string;
  /** 期待される組織名 */
  expectedOrgName?: string;
}

/** {@link handleAdClicked} の引数 */
export interface HandleAdClickedParams extends VerificationContext {
  /** 対象タブID */
  tabId: number;
  /** 新規タブで開かれたクリックか */
  isNewTab?: boolean;
  /** 広告元ページのURL */
  sourceUrl?: string;
}

/** {@link executeWarningRedirect} の引数 */
export interface ExecuteWarningRedirectParams extends WarningSearchParams {
  /** リダイレクト対象のタブID */
  tabId: number;
}

/** {@link handleVerification} の引数 */
export interface HandleVerificationParams extends VerificationContext {
  /** 検証対象のタブID */
  tabId: number;
  /** 検証対象のURL */
  url: string;
  /** 広告元のURL */
  sourceUrl?: string;
  /** 新規タブからの遷移か */
  isNewTab?: boolean;
}

/** {@link createMismatchResult} の引数 */
export interface CreateMismatchResultParams extends VerificationContext {
  /** 遷移先の組織名 */
  destinationOrgName?: string;
  /** OPID未設定か（不一致ではなく） */
  isMissing: boolean;
}

/** pendingOpIdVerification に格納されるデータ */
export interface PendingVerificationData {
  targetOpId: string;
  sourceOrgName?: string;
  expectedOrgName?: string;
  warnedUrl?: string;
  sourceUrl?: string;
  isNewTab?: boolean;
}

/** verificationCache に格納されるデータ */
export interface VerificationCacheData {
  [url: string]: LinkVerificationResult;
}
