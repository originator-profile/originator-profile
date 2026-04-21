import { Spinner, _ } from "@originator-profile/ui";
import { useCredentials } from "../components/credentials/use-credentials";

function Loading() {
  const { origin } = useCredentials();
  return (
    <div className="w-full h-screen flex justify-center items-center">
      <div className="p-2 flex flex-col items-center gap-4">
        <Spinner />
        <p className="whitespace-pre-line">
          {_(
            "Loading_RetrievingAndValidatingProfile",
            origin && _("Loading_OfOrigin", origin),
          )}
        </p>
      </div>
    </div>
  );
}

export default Loading;
