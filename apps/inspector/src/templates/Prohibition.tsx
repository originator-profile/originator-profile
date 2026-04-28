import { _ } from "@originator-profile/ui";
import GlobalHeader from "../components/GlobalHeader";
import { useLinkVerification } from "../components/credentials/use-link-verification";

function Prohibition() {
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
        <div className="flex flex-col items-center justify-center gap-2 mb-4">
          <h1
            className="whitespace-pre-line text-lg text-center font-bold"
            data-testid="p-elm-prohibition-message"
          >
            {_("Prohibition_Warning")}
          </h1>
          {hasLinkVerification && (
            <p className="flex items-center flex-col gap-4 mt-2 mb-2">
              <span className="whitespace-pre-line text-red-700 text-sm tracking-normal text-center w-auto inline-block align-middle">
                {_(titleKey)}
              </span>
            </p>
          )}
        </div>
        <p className="flex items-center flex-col gap-4 mb-2">
          <span className="whitespace-pre-line text-red-700 text-sm tracking-normal text-center w-auto inline-block align-middle">
            {_("Prohibition_Site")}
          </span>
        </p>
        <p className="text-sm text-center underline">
          <a
            href="https://originator-profile.org/"
            target="_blank"
            rel="noreferrer noopener"
          >
            {_("Link_OriginatorProfile")}
          </a>
        </p>
      </main>
    </>
  );
}

export default Prohibition;
