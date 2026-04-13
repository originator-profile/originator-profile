import { _ } from "@originator-profile/ui";
import GlobalHeader from "./GlobalHeader";
import { useLinkVerification } from "./credentials/use-link-verification";

function Messages({ errors }: { errors: Error[] }) {
  const errorWithCode = errors.filter((error) => "code" in error);
  const hasOtherErrors = errors.length !== errorWithCode.length;

  return (
    <ul className="list-disc list-inside text-sm max-w-xs mx-auto">
      {errorWithCode.length > 0 &&
        errorWithCode.map((error, index) => (
          <li key={index}>{_(`Unsupported_${error.code as string}`)}</li>
        ))}
      {hasOtherErrors && <li>{_("Unsupported_UnknownError")}</li>}
    </ul>
  );
}

type Props = {
  errors: Error[];
};

function Unsupported({ errors }: Props) {
  const verificationResult = useLinkVerification();
  const hasLinkVerification =
    verificationResult &&
    verificationResult.status !== "none" &&
    verificationResult.status !== "matched";

  const titleKey =
    verificationResult?.status === "mismatched"
      ? "LinkVerification_Mismatched_Title"
      : "LinkVerification_MissingOpid_Title";

  return (
    <>
      <GlobalHeader className="sticky top-0 z-10" />
      <main className="min-h-screen bg-gray-100 overflow-y-auto px-4 py-6">
        <article className="mb-12 max-w-sm mx-auto">
          <div className="flex flex-col items-center justify-center gap-2 mb-4">
            <h1 className="whitespace-pre-line text-lg text-center font-bold">
              {_("Unsupported_ContactSiteOperator")}
            </h1>
            {hasLinkVerification && (
              <p className="flex items-center flex-col gap-4 mt-2 mb-2">
                <span className="whitespace-pre-line text-red-700 text-sm tracking-normal text-center w-auto inline-block align-middle">
                  {_(titleKey)}
                </span>
              </p>
            )}
          </div>
          <div
            className="whitespace-pre-line text-sm text-gray-700 text-center mb-2"
            data-testid="p-elm-unsupported-message"
          >
            <Messages errors={errors} />
          </div>
          <p className="text-sm text-center underline">
            <a
              href="https://originator-profile.org/"
              target="_blank"
              rel="noreferrer noopener"
            >
              {_("Link_OriginatorProfile")}
            </a>
          </p>
        </article>
      </main>
    </>
  );
}

export default Unsupported;
