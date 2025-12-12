import { _ } from "@originator-profile/ui";
import GlobalHeader from "./GlobalHeader";

function Messages({
  errors
}: {
  errors: Error[];
}) {
  const errorWithCode = errors.filter((error) => "code" in error);
  const hasOtherErrors = errors.length !== errorWithCode.length;

  return (
    <>
      {errorWithCode.length > 0 ? (
        errorWithCode.map((error) => (
          <p>{_(`Unsupported_${error.code as string}`)}</p>
        ))
      ) : hasOtherErrors ? (
        <p>{_("Unsupported_UnknownError")}</p>
      ) : null}
    </>
  );
}

type Props = {
  errors: Error[];
};

function Unsupported({ errors }: Props) {
  return (
    <>
      <GlobalHeader className="sticky top-0 z-10" />
      <main className="min-h-screen bg-gray-100 overflow-y-auto px-4 py-3">
        <article className="mb-12 max-w-sm mx-auto">
          <h1 className="whitespace-pre-line text-lg mb-2 text-center font-bold">
            {_("Unsupported_ContactSiteOperator")}
          </h1>
          <p
            className="whitespace-pre-line text-sm text-gray-700 text-center mb-2"
            data-testid="p-elm-unsupported-message"
          >
            <Messages errors={errors} />
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
        </article>
      </main>
    </>
  );
}

export default Unsupported;
