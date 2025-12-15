import { stringifyWithError } from "@originator-profile/core";
import { _, ProjectSummary, ProjectTitle } from "@originator-profile/ui";
import type { VerifiedOps, VerifiedSp } from "@originator-profile/verify";
import JsonView from "@uiw/react-json-view";
import BackHeader from "../components/BackHeader";
import type { FrameVerifiedCas } from "../components/credentials";
import ErrorCheckList from "../components/ErrorCheckList";

type DetailInfoProps = {
  sp?: VerifiedSp;
  ops?: VerifiedOps;
  framesCas?: FrameVerifiedCas[];
  errors: Error[];
  backPath: {
    pathname: string;
    search: string;
  };
};

function DetailInfo({ sp, ops, framesCas, errors, backPath }: DetailInfoProps) {
  return (
    <>
      <BackHeader className="sticky top-0 z-10" to={backPath}>
        {_("DetailInfo")}
      </BackHeader>
      <main className="min-h-screen bg-white overflow-y-auto px-4 py-12">
        <ProjectTitle className="mb-12" as="header" />
        <article className="mb-12 max-w-6xl mx-auto">
          <div className="mb-8">
            <h2 className="pl-4 mb-4 text-sm font-bold text-gray-700">
              {_("DetailInfo_VerificationResults")}
            </h2>
            <ErrorCheckList errors={errors} />
          </div>
          <h2 className="pl-4 mb-4 text-sm font-bold text-gray-700">
            {_("DetailInfo")}
          </h2>
          <JsonView
            className="pl-4 mb-8 overflow-auto"
            value={JSON.parse(
              stringifyWithError({
                "Site Profile": sp ?? null,
                "Originator Profile Set": ops ?? null,
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
