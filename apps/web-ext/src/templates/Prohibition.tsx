import { _ } from "@originator-profile/ui";
import GlobalHeader from "../components/GlobalHeader";
import LinkVerification from "../components/LinkVerification";

function Prohibition() {
  return (
    <>
      <GlobalHeader className="sticky top-0 z-10" />
      <LinkVerification />
      <main className="min-h-screen bg-gray-100 overflow-y-auto px-4 py-3">
        <h1
          className="whitespace-pre-line text-lg mb-2 text-center font-bold"
          data-testid="p-elm-prohibition-message"
        >
          {_("Prohibition_Warning")}
        </h1>
        <h1 className="flex items-center flex-col gap-4 mb-2">
          <span className="whitespace-pre-line text-red-700 text-sm tracking-normal text-center w-auto inline-block align-middle">
            {_("Prohibition_Site")}
          </span>
        </h1>
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
