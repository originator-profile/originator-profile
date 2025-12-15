import {
  _,
  ProjectTitle,
  ProjectSummary,
  useSanitizedHtml,
} from "@originator-profile/ui";
import { Link } from "react-router";
import { buildPublUrl } from "../utils/routes";
import ErrorCheckList from "../components/ErrorCheckList";
import BackHeader from "../components/BackHeader";

function WarningDetails({ tabId }: { tabId: number }) {
  return (
    <div className="pt-3">
      <p className="whitespace-pre-line">{_("Prohibition_DetailStatement")}</p>
      <ol className="pt-3 px-0.5 list-decimal">
        <li>{_("Prohibition_DetailReason_1")}</li>
        <li>{_("Prohibition_DetailReason_2")}</li>
      </ol>
      <p className="whitespace-pre-line pt-3">
        {_("Prohibition_DetailAdditional")}
      </p>
      <Link
        className="block text-gray-500 pb-3 pt-3"
        to={buildPublUrl(tabId, undefined)}
      >
        {_("Prohibition_DetailProceed")}
      </Link>
    </div>
  );
}

type DetailInfoProps = {
  errors: Error[];
  tabId: number;
  backPath: {
    pathname: string;
    search: string;
  };
};

function DetailInfo({ errors, tabId, backPath }: DetailInfoProps) {
  const prohibitionStatement =
    useSanitizedHtml(_("Prohibition_Statement_HTML")) ?? "";
  return (
    <>
      <BackHeader className="sticky top-0 z-10" to={backPath}>
        {_("DetailInfo")}
      </BackHeader>
      <main className="min-h-screen bg-white overflow-y-auto px-4 py-12">
        <ProjectTitle className="mb-12" as="header" />
        <article className="mb-12 max-w-sm mx-auto">
          <ErrorCheckList errors={errors} />
          <p
            className="text-sm tracking-normal text-left font-normal"
            data-testid="p-elm-prohibition-message"
            dangerouslySetInnerHTML={{
              __html: prohibitionStatement,
            }}
          />
          <details className="text-gray-700 pt-3">
            <summary>{_("Prohibition_StatementDetail")}</summary>
            <WarningDetails tabId={tabId} />
          </details>
          <div className="pt-3">
            <ProjectSummary as="footer" />
          </div>
        </article>
      </main>
    </>
  );
}

export default DetailInfo;
