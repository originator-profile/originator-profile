import {
  SiteProfileFetchFailed,
  SiteProfileFetchInvalid,
} from "@originator-profile/presentation";
import {
  type Logger,
  SpVerifier,
  type VerifiedSp,
} from "@originator-profile/verify";
import { getRegistry } from "../../utils/registry-ops";
import { fetchTabSiteProfile } from "./messaging";

/**
 * タブの Site Profile を取得して検証する。
 * @param tabId タブID
 * @param options ロガー
 * @returns 検証済み Site Profile
 * @throws 取得または検証に失敗した場合
 */
export async function verifyTabSiteProfile(
  tabId: number,
  options: { logger?: Logger } = {},
): Promise<VerifiedSp> {
  const data = await fetchTabSiteProfile(tabId);
  const registry = await getRegistry();

  const verifySp = SpVerifier(
    {
      ...data.result,
      originators: [...registry.ops, ...data.result.originators],
    },
    registry.keys,
    registry.issuer,
    data.origin,
    options,
  );

  const verifiedSp = await verifySp();
  if (verifiedSp instanceof Error) {
    throw verifiedSp;
  }
  return verifiedSp;
}

/**
 * Site Profile の取得に失敗したエラーか。
 *
 * Site Profile 未設置はこのエラーになる。検証の失敗とは区別する。
 *
 * NOTE: メッセージ境界を跨いだエラーは Error インスタンスに復元されるが
 * 元のクラスではなくなるため、`code` で判定する。
 */
export function isSiteProfileFetchError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) return false;
  return (
    error.code === SiteProfileFetchFailed.code ||
    error.code === SiteProfileFetchInvalid.code
  );
}
