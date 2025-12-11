import {
  ProjectSummary,
  ProjectTitle,
  _,
  useSanitizedHtml,
} from "@originator-profile/ui";
import figUser1Url from "../assets/fig-user-1.svg";
import figUser2Url from "../assets/fig-user-2.svg";
import figUser3Url from "../assets/fig-user-3.svg";
import figUser4Url from "../assets/fig-user-4.svg";
import figUser5Url from "../assets/fig-user-5.svg";
import figTraceabilityUrl from "../assets/fig-traceability.png";
import ErrorCheckList from "./ErrorCheckList";
import GlobalHeader from "./GlobalHeader";

function Messages({
  className,
  errors,
}: {
  className?: string;
  errors: Error[];
}) {
  const errorWithCode = errors.filter((error) => "code" in error);
  const hasOtherErrors = errors.length !== errorWithCode.length;

  return (
    <ul className={className}>
      {errorWithCode.map((error, index) => (
        <li key={index}>{_(`Unsupported_${error.code as string}`)}</li>
      ))}
      {hasOtherErrors && (
        <>
          <li>{_("Unsupported_NoReliabilityInformationYet")}</li>
          <li>{_("Unsupported_ReliabilityInformationRetrievalFailed")}</li>
        </>
      )}
    </ul>
  );
}

type Props = {
  errors: Error[];
};

function Unsupported({ errors }: Props) {
  const disclaimerHtml =
    useSanitizedHtml(_("Unsupported_OPDisclaimer_HTML")) ?? "";
  return (
    <>
      <GlobalHeader className="sticky top-0 z-10" />
      <main className="min-h-screen bg-white overflow-y-auto px-4 py-12">
        <ProjectTitle className="mb-12" as="header" />
        <article className="mb-12 max-w-sm mx-auto">
          <h1 className="whitespace-pre-line text-lg mb-6 text-center">
            {_("Unsupported_ReliabilityInformationReadError")}
          </h1>
          <ErrorCheckList errors={errors} />
          <p
            className="whitespace-pre-line text-xs text-gray-700 text-center mb-8"
            data-testid="p-elm-unsupported-message"
          >
            {_("Unsupported_FollowingCausesConsidered")}
          </p>
          <Messages
            className="list-disc pl-8 text-sm mb-12 max-w-sm mx-auto"
            errors={errors}
          />
          <p className="whitespace-pre-line text-xs text-gray-700 text-center leading-5">
            {_("Unsupported_ReliabilityInformationContactStatement")}
          </p>
        </article>
        <article className="prose max-w-lg mx-auto">
          <h1 className="whitespace-pre-line text-lg mb-6 text-center font-normal">
            {_("Unsupported_ReliabilityResolvesFollowings")}
          </h1>
          <section>
            <h2 className="whitespace-pre-line after:content-[''] after:block after:absolute after:bg-sky-500 after:opacity-30 after:w-32 after:h-1 after:mt-1">
              {_("Unsupported_ChallengeInternetUser")}
            </h2>
            <div className="flex items-center justify-between gap-8 mb-4 md:mb-1">
              <img className="shrink-0 my-0" src={figUser1Url} alt="" />
              <p className="whitespace-pre-line text-sky-700 text-lg font-bold p-4 border-2 border-sky-600 rounded-3xl grow">
                {_("Unsupported_ChallengeReliableInformation")}
              </p>
            </div>
            <div className="flex flex-row-reverse items-center justify-between gap-8 mb-4 md:mb-1">
              <img className="shrink-0 my-0" src={figUser2Url} alt="" />
              <p className="whitespace-pre-line text-sky-700 text-lg font-bold p-4 border-2 border-sky-600 rounded-3xl grow">
                {_("Unsupported_ChallengeFakeNews")}
              </p>
            </div>
            <p className="whitespace-pre-line">
              {_("Unsupported_ChallengeReliabilityProblemAndSolutionStatement")}
            </p>
          </section>
          <section>
            <h2 className="whitespace-pre-line after:content-[''] after:block after:absolute after:bg-sky-500 after:opacity-30 after:w-32 after:h-1 after:mt-1">
              {_("Unsupported_ChallengeAdAndMedia")}
            </h2>
            <div className="flex items-center justify-between gap-8 mb-4 md:mb-1">
              <img className="shrink-0 my-0" src={figUser5Url} alt="" />
              <p className="whitespace-pre-line text-sky-700 text-lg font-bold p-4 border-2 border-sky-600 rounded-3xl grow">
                {_("Unsupported_ChallengeSketchySite")}
              </p>
            </div>
            <div className="flex flex-row-reverse items-center justify-between gap-8 mb-4 md:mb-1">
              <img className="shrink-0 my-0" src={figUser3Url} alt="" />
              <p className="whitespace-pre-line text-sky-700 text-lg font-bold p-4 border-2 border-sky-600 rounded-3xl grow">
                {_("Unsupported_ChallengeAdClashWithArticle")}
              </p>
            </div>
            <p className="whitespace-pre-line">
              {_("Unsupported_ChallengeAdRiskAndSolutionStatement")}
            </p>
          </section>
          <section className="mb-12">
            <h2 className="whitespace-pre-line after:content-[''] after:block after:absolute after:bg-sky-500 after:opacity-30 after:w-32 after:h-1 after:mt-1">
              {_("Unsupported_ChallengeHowever")}
            </h2>
            <div className="flex items-center justify-between gap-8 mb-4 md:mb-1">
              <img className="shrink-0 my-0" src={figUser4Url} alt="" />
              <p className="whitespace-pre-line text-sky-700 text-lg font-bold p-4 border-2 border-sky-600 rounded-3xl grow">
                {_("Unsupported_ChallengeInformationRegulation")}
              </p>
            </div>
            <p
              dangerouslySetInnerHTML={{
                __html: disclaimerHtml,
              }}
            />
          </section>
          <section className="mb-8">
            <h2 className="whitespace-pre-line text-lg mb-6 text-center font-normal">
              {_("Unsupported_ChallengeIfThereWereInformation")}
            </h2>
            <img
              className="mx-auto"
              src={figTraceabilityUrl}
              alt=""
              width={420}
              height={248}
            />
            <p className="whitespace-pre-line">
              {_("Unsupported_ChallengeReliabilityBenefits")}
            </p>
            <div className="flex justify-center">
              <a
                className="jumpu-button text-white"
                href="https://originator-profile.org/"
                target="_blank"
                rel="noreferrer noopener"
              >
                {_("Unsupported_MoreDetailsOP")}
              </a>
            </div>
          </section>
        </article>
        <ProjectSummary as="footer" />
      </main>
    </>
  );
}

export default Unsupported;
