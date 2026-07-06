import { Icon } from "@iconify/react";
import { stringifyWithError } from "@originator-profile/core";
import {
  _,
  ProjectSummary,
  ProjectTitle,
  Table,
  TableRow,
} from "@originator-profile/ui";
import type { VerifiedOps, VerifiedSp } from "@originator-profile/verify";
import JsonView from "@uiw/react-json-view";
import BackHeader from "../components/BackHeader";
import CheckList from "../components/CheckList";
import type {
  FrameVerifiedCas,
  SupportedVerifiedCas,
} from "../components/credentials";
import { useLinkVerification } from "../components/credentials/use-link-verification";

type DetailInfoProps = {
  sp?: VerifiedSp;
  ops?: VerifiedOps;
  cas?: SupportedVerifiedCas;
  framesCas?: FrameVerifiedCas[];
  errors: Error[];
  warnings?: string[];
  backPath: {
    pathname: string;
    search: string;
  };
};

function DetailInfo({
  sp,
  ops,
  cas,
  framesCas,
  errors,
  warnings = [],
  backPath,
}: DetailInfoProps) {
  const linkVerification = useLinkVerification();
  const hasLinkVerification =
    linkVerification && linkVerification.status !== "none";

  return (
    <>
      <BackHeader className="sticky top-0 z-10" to={backPath}>
        {_("DetailInfo")}
      </BackHeader>
      <main className="min-h-screen bg-white overflow-y-auto px-4 py-12">
        <ProjectTitle className="mb-12" as="header" />
        <article className="mb-12 max-w-6xl mx-auto">
          <div className="mb-8">
            <h2
              data-testid="verification-results"
              className="pl-4 mb-4 text-sm font-bold text-gray-700"
            >
              {_("DetailInfo_VerificationResults")}
            </h2>
            <CheckList sp={sp} ops={ops} cas={cas} errors={errors} />
          </div>

          {hasLinkVerification && (
            <div className="pl-4 mb-8">
              <h2 className="mb-4 text-sm font-bold text-gray-700">
                {_("DetailInfo_LinkVerification")}
              </h2>
              <Table>
                <TableRow
                  header={_("DetailInfo_ExpectedLinkDestination")}
                  data={linkVerification.expectedOrgName || "-"}
                />
                <TableRow
                  header={_("DetailInfo_SourceAdOrganization")}
                  data={linkVerification.sourceOrgName || "-"}
                />
              </Table>
            </div>
          )}

          <h2 className="pl-4 mb-4 text-sm font-bold text-gray-700">
            {_("DetailInfo")}
          </h2>
          {warnings.length > 0 && (
            <div className="pl-4 mb-8" data-testid="verification-warnings">
              <h3 className="mb-4 text-sm font-bold text-gray-700">
                {_("DetailInfo_Warnings")}
              </h3>
              <ul>
                {warnings.map((warning, index) => (
                  <li
                    key={index}
                    className="flex items-start mb-2 text-sm text-gray-700"
                  >
                    <Icon
                      icon="ic:round-warning"
                      className="size-5 mr-1 shrink-0 text-caution"
                    />
                    <span className="whitespace-pre-wrap break-all">
                      {warning}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <JsonView
            className="pl-4 mb-8 overflow-auto"
            value={JSON.parse(
              stringifyWithError({
                "Content Attestation Set (Per Frame)": framesCas ?? null,
              }),
            )}
            shouldExpandNodeInitially={(isExpanded, { level }) =>
              level > 2 ? false : isExpanded
            }
          />
          <ProjectSummary as="footer" />
        </article>
      </main>
    </>
  );
}

export default DetailInfo;
