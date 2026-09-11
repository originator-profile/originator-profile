import type {
  LinkVerificationResult,
  OrgRef,
} from "@originator-profile/extension-common";
import { _, Table, TableRow } from "@originator-profile/extension-common/ui";
import { linkVerificationTitle } from "./credentials/link-verification-title";
import { useLinkVerification } from "./credentials/use-link-verification";

/**
 * 組織を「名前 OP ID」の形で表示する
 *
 * OP ID を併記しないと、期待される運営者と実際の運営者が別組織でも組織名が
 * 同じであれば不一致を確認できない。
 */
function Org({ org }: { org?: OrgRef }) {
  if (!org) return "-";
  return (
    <>
      {org.name && <span className="mr-1">{org.name}</span>}
      <span className="text-gray-500">{org.id}</span>
    </>
  );
}

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
          header={_("DetailInfo_LinkVerificationStatus")}
          data={linkVerificationTitle(result.status)}
        />
        {result.reason && (
          <TableRow
            header={_("DetailInfo_LinkVerificationReason")}
            data={result.reason}
          />
        )}
        <TableRow
          header={_("DetailInfo_ExpectedLinkDestination")}
          data={<Org org={result.expectedOperator} />}
        />
        <TableRow
          header={_("DetailInfo_ActualSiteOperator")}
          data={<Org org={result.actualOperator} />}
        />
        <TableRow
          header={_("DetailInfo_SourceAdOrganization")}
          data={<Org org={result.source} />}
        />
      </Table>
    </div>
  );
}
