import { _, ProjectTitle, ProjectSummary } from "@originator-profile/ui";
import ErrorCheckList from "../components/ErrorCheckList";
import BackHeader from "../components/BackHeader";
import JsonView from "@uiw/react-json-view";
import { stringifyWithError } from "@originator-profile/core";
import type { FrameVerifiedCas } from "../components/credentials";
import type { VerifiedSp, VerifiedOps } from "@originator-profile/verify";

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
            <ErrorCheckList errors={errors} />
          </div>
          <JsonView
            className="pl-4 mb-8 overflow-auto"
            value={JSON.parse(
              stringifyWithError({
                "Site Profile": sp ?? null,
                "Originator Profile Set": ops ?? null,
                "Content Attestation Set (Per Frame)": framesCas ?? null,
              }),
            )}
            shouldExpandNodeInitially={(isExpaned, { level }) =>
              level > 2 ? false : isExpaned
            }
          />
          <ProjectSummary as="footer" />
        </article>
      </main>
    </>
  );
}

export default DetailInfo;
