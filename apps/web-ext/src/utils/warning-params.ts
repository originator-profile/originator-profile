/** Warning ページの URL search params 型定義 */
export interface WarningSearchParams {
  /** 警告対象の遷移先 URL */
  target: string;
  /** 警告理由メッセージ */
  reason: string;
  /** 広告元の組織名 */
  sourceOrg?: string;
  /** 遷移先の組織名 */
  destOrg?: string;
  /** 期待される組織名 */
  expectedOrg?: string;
  /** 広告元のURL（戻るボタン用） */
  original?: string;
  /** 新規タブで開かれたか */
  isNewTab?: boolean;
}

/**
 * {@link WarningSearchParams} を {@link URLSearchParams} に変換する
 *
 * オプショナルフィールドは値がある場合のみ設定される。
 * `isNewTab` は `true` の場合のみ `"true"` としてセットされる。
 */
export function buildWarningSearchParams(
  params: WarningSearchParams,
): URLSearchParams {
  const sp = new URLSearchParams({
    target: params.target,
    reason: params.reason,
  });
  if (params.sourceOrg) sp.append("sourceOrg", params.sourceOrg);
  if (params.destOrg) sp.append("destOrg", params.destOrg);
  if (params.expectedOrg) sp.append("expectedOrg", params.expectedOrg);
  if (params.original) sp.append("original", params.original);
  if (params.isNewTab) sp.append("isNewTab", "true");
  return sp;
}

/** {@link URLSearchParams.get} の null を undefined に変換する（オプショナルフィールド用） */
function getOptionalParam(
  sp: URLSearchParams,
  key: string,
): string | undefined {
  return sp.get(key) ?? undefined;
}

/**
 * {@link URLSearchParams} を {@link WarningSearchParams} に変換する
 *
 * `target` と `reason` は必須であり、存在しない場合は空文字列になる。
 */
export function parseWarningSearchParams(
  sp: URLSearchParams,
): WarningSearchParams {
  return {
    target: sp.get("target") ?? "",
    reason: sp.get("reason") ?? "",
    sourceOrg: getOptionalParam(sp, "sourceOrg"),
    destOrg: getOptionalParam(sp, "destOrg"),
    expectedOrg: getOptionalParam(sp, "expectedOrg"),
    original: getOptionalParam(sp, "original"),
    isNewTab: sp.get("isNewTab") === "true" ? true : undefined,
  };
}
