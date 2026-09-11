import type { LinkVerificationResult } from "@originator-profile/extension-common";
import { _ } from "@originator-profile/extension-common/ui";

/**
 * リンク先確認の判定を表す見出し
 * @param status 判定。未検証 (none) と未取得のときは undefined を返す
 */
export function linkVerificationTitle(
  status: LinkVerificationResult["status"] | undefined,
): string | undefined {
  switch (status) {
    case "matched":
      return _("LinkVerification_Matched_Title");
    case "mismatched":
      return _("LinkVerification_Mismatched_Title");
    case "missing_opid":
      return _("LinkVerification_MissingOpid_Title");
    case "error":
      return _("LinkVerification_Error_Title");
    default:
      return undefined;
  }
}
