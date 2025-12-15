import { _, ProjectTitle, ProjectSummary } from "@originator-profile/ui";
import ErrorCheckList from "../components/ErrorCheckList";
import BackHeader from "../components/BackHeader";

type DetailInfoProps = {
  errors: Error[];
  backPath: {
    pathname: string;
    search: string;
  };
};

function DetailInfo({ errors, backPath }: DetailInfoProps) {
  return (
    <>
      <BackHeader className="sticky top-0 z-10" to={backPath}>
        {_("DetailInfo")}
      </BackHeader>
      <main className="min-h-screen bg-white overflow-y-auto px-4 py-12">
        <ProjectTitle className="mb-12" as="header" />
        <article className="mb-12 max-w-sm mx-auto">
          <ErrorCheckList errors={errors} />
          <div className="pt-3">
            <ProjectSummary as="footer" />
          </div>
        </article>
      </main>
    </>
  );
}

export default DetailInfo;
