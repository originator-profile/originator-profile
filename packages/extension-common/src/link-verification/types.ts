/**
 * 組織の識別子と表示名
 *
 * name は Web Media Profile から解決する。解決できなければ undefined。
 */
export type OrgRef = {
  /** OP ID */
  id: string;
  /** 組織名 */
  name?: string;
};

/** リンク先確認の結果 */
export type LinkVerificationResult = {
  status: "matched" | "mismatched" | "missing_opid" | "error" | "none";
  /**
   * リンク元コンテンツを表明した組織
   *
   * NOTE: ページが埋め込んだ Originator Profile Set を復号しただけで署名は
   * 検証していない。自称値として扱うこと
   */
  source?: OrgRef;
  /** targetopid が表明する、期待される運営者。source と同じく未検証 */
  expectedOperator?: OrgRef;
  /** 遷移先サイトが署名で示す、実際にサイトを運営している組織 */
  actualOperator?: OrgRef;
  reason?: string;
};

/**
 * 警告ページの URL を組み立てる
 *
 * 警告ページの場所はアプリごとに異なるため、呼び出し側から与える。
 */
export type WarningUrlBuilder = (params: URLSearchParams) => string;

/**
 * リンク先確認の入力
 *
 * NOTE: どちらもリンク元ページが自ら埋め込んだ値を復号しただけで、署名は検証
 * していない。表示にのみ使い、照合には expectedOperator.id だけを使う
 */
export interface VerificationContext {
  /** リンク元コンテンツを表明した組織 */
  source?: OrgRef;
  /** targetopid が表明する、期待される運営者 */
  expectedOperator: OrgRef;
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
  destinationUrl: string;
  /** リンク元ページの URL（戻るボタン用） */
  sourceUrl?: string;
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
export interface CreateMismatchResultParams extends VerificationContext {
  /** 遷移先サイトが署名で示す、実際の運営者 */
  actualOperator?: OrgRef;
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
