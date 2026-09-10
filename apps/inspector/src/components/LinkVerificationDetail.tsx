import type { LinkVerificationResult } from "@originator-profile/extension-common";
import { _, Table, TableRow } from "@originator-profile/extension-common/ui";
import { useLinkVerification } from "./credentials/use-link-verification";

/** 詳細情報画面のリンク先確認セクション */
export default function LinkVerificationDetail() {
  const result: LinkVerificationResult | undefined = useLinkVerification();
  if (!result || result.status === "none") return null;

  return (
    <div className="pl-4 mb-8">
      <h2 className="mb-4 text-sm font-bold text-gray-700">
        {_("DetailInfo_LinkVerification")}
      </h2>
      <Table>
        <TableRow
          header={_("DetailInfo_ExpectedLinkDestination")}
          data={result.expectedOperator?.name || "-"}
        />
        <TableRow
          header={_("DetailInfo_SourceAdOrganization")}
          data={result.source?.name || "-"}
        />
      </Table>
    </div>
  );
}
