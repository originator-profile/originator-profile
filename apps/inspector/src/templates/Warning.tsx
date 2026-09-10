import IconFa6SolidTriangleExclamation from "@iconify-react/fa6-solid/triangle-exclamation";
import { _ } from "@originator-profile/extension-common/ui";

type Props = {
  sourceOrg: string | undefined;
  expectedOrg: string | undefined;
  actualOrg: string | undefined;
  destinationUrl: string | null;
  backButtonLabel: string;
  onBack: () => void;
  onProceed: () => void;
};

function Warning({
  sourceOrg,
  expectedOrg,
  actualOrg,
  destinationUrl,
  backButtonLabel,
  onBack,
  onProceed,
}: Props) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <IconFa6SolidTriangleExclamation className="mb-4 w-16 h-16 mx-auto text-red-500" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">
          {_("Warning_Title")}
        </h1>
        <p className="text-gray-600 mb-6">
          {expectedOrg || sourceOrg || actualOrg ? (
            <>
              {expectedOrg ? _("Warning_IntendedSite", expectedOrg) : ""}
              {sourceOrg
                ? _("Warning_ClickedAd", sourceOrg)
                : _("Warning_ClickedAdGeneric")}
              {actualOrg
                ? _("Warning_OperatedBy", actualOrg)
                : _("Warning_CannotVerify")}
            </>
          ) : (
            _("Warning_OpidMismatch")
          )}
        </p>
        <div className="space-y-3">
          <button
            onClick={onBack}
            className="w-full bg-primary-700 text-white py-2 px-4 rounded hover:bg-primary-800 transition duration-200"
          >
            {backButtonLabel}
          </button>
          <button
            onClick={onProceed}
            disabled={!destinationUrl}
            className={`w-full py-2 px-4 rounded transition duration-200 ${
              destinationUrl
                ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {_("Warning_Proceed")}
          </button>
        </div>
        {destinationUrl && (
          <div className="mt-6 text-xs text-gray-400 break-all">
            {_("Warning_Destination")}
            {destinationUrl}
          </div>
        )}
      </div>
    </div>
  );
}

export default Warning;
