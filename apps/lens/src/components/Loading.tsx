import { Spinner, _ } from "@originator-profile/extension-common/ui";

function Loading({ origin }: { origin?: string }) {
  return (
    <main className="w-full h-screen flex justify-center items-center">
      <div className="p-2 flex flex-col items-center gap-4">
        <div aria-hidden>
          <Spinner />
        </div>
        <p className="whitespace-pre-line" role="status">
          {_(
            "Loading_RetrievingAndValidatingProfile",
            origin && _("Loading_OfOrigin", origin),
          )}
        </p>
      </div>
    </main>
  );
}

export default Loading;
