import type { LinkVerificationResult } from "../credentials/types";

/**
 * 警告ページの URL を組み立てる
 *
 * 警告ページの場所はアプリごとに異なるため、呼び出し側から与える。
 */
export type WarningUrlBuilder = (params: URLSearchParams) => string;

/** 広告リンク検証の共通コンテキスト情報 */
export interface VerificationContext {
  /** 検証対象の Originator Profile ID */
  targetOpId: string;
  /** 広告元の組織名 */
  sourceOrgName?: string;
  /** 期待される組織名 */
  expectedOrgName?: string;
}

/** 広告クリックのハンドラの引数 */
export interface HandleAdClickedParams {
  /** 対象タブID */
  tabId: number;
  /** 検証コンテキスト */
  context: VerificationContext;
  /** 新規タブで開かれたクリックか */
  isNewTab?: boolean;
  /** 広告元ページのURL */
  sourceUrl?: string;
}

/** 警告ページへのリダイレクトの引数 */
export interface ExecuteWarningRedirectParams {
  /** リダイレクト対象のタブID */
  tabId: number;
  /** 警告の根拠となる検証結果 */
  result: LinkVerificationResult;
  /** 警告対象の遷移先 URL */
  target: string;
  /** 広告元のURL（戻るボタン用） */
  original?: string;
  /** 新規タブで開かれたか */
  isNewTab?: boolean;
}

/** リンク検証のハンドラの引数 */
export interface HandleVerificationParams {
  /** 検証対象のタブID */
  tabId: number;
  /** 検証対象のURL */
  url: string;
  /** 検証コンテキスト */
  context: VerificationContext;
  /** 広告元のURL */
  sourceUrl?: string;
  /** 新規タブからの遷移か */
  isNewTab?: boolean;
}

/** OPID 不一致・未設定の結果を組み立てる引数 */
export interface CreateMismatchResultParams extends Omit<
  VerificationContext,
  "targetOpId"
> {
  /** 遷移先の組織名 */
  destinationOrgName?: string;
  /** OPID未設定か（不一致ではなく） */
  isMissing: boolean;
}

/** pendingOpIdVerification に格納されるデータ */
export interface PendingVerificationData extends VerificationContext {
  warnedUrl?: string;
  sourceUrl?: string;
  isNewTab?: boolean;
}

/** verificationCache に格納されるデータ */
export interface VerificationCacheData {
  [url: string]: LinkVerificationResult;
}
