/** Warning ページの URL search params 型定義 */
export interface WarningSearchParams {
  /** 警告対象の遷移先 URL */
  destinationUrl: string;
  /** 警告理由メッセージ */
  reason: string;
  /** リンク元コンテンツの組織名 */
  sourceOrg?: string;
  /** targetopid が表明する、期待される運営者の組織名 */
  expectedOrg?: string;
  /** 遷移先サイトが署名で示す、実際の運営者の組織名 */
  actualOrg?: string;
  /** リンク元ページの URL（戻るボタン用） */
  sourceUrl?: string;
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
    destinationUrl: params.destinationUrl,
    reason: params.reason,
  });
  if (params.sourceOrg) sp.append("sourceOrg", params.sourceOrg);
  if (params.expectedOrg) sp.append("expectedOrg", params.expectedOrg);
  if (params.actualOrg) sp.append("actualOrg", params.actualOrg);
  if (params.sourceUrl) sp.append("sourceUrl", params.sourceUrl);
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
 * `destinationUrl` と `reason` は必須であり、存在しない場合は空文字列になる。
 */
export function parseWarningSearchParams(
  sp: URLSearchParams,
): WarningSearchParams {
  return {
    destinationUrl: sp.get("destinationUrl") ?? "",
    reason: sp.get("reason") ?? "",
    sourceOrg: getOptionalParam(sp, "sourceOrg"),
    expectedOrg: getOptionalParam(sp, "expectedOrg"),
    actualOrg: getOptionalParam(sp, "actualOrg"),
    sourceUrl: getOptionalParam(sp, "sourceUrl"),
    isNewTab: sp.get("isNewTab") === "true" ? true : undefined,
  };
}
