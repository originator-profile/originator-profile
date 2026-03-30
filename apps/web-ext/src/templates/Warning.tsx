import { Icon } from "@iconify/react";
import { _ } from "@originator-profile/ui";

type Props = {
  sourceOrg: string | undefined;
  destOrg: string | undefined;
  expectedOrg: string | undefined;
  target: string | null;
  backButtonLabel: string;
  onBack: () => void;
  onProceed: () => void;
};

function Warning({
  sourceOrg,
  destOrg,
  expectedOrg,
  target,
  backButtonLabel,
  onBack,
  onProceed,
}: Props) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <Icon
          className="mb-4 w-16 h-16 mx-auto text-red-500"
          icon="fa6-solid:triangle-exclamation"
        />
        <h1 className="text-xl font-bold text-gray-800 mb-2">
          {_("Warning_Title")}
        </h1>
        <p className="text-gray-600 mb-6">
          {sourceOrg ? (
            <>
              {expectedOrg ? _("Warning_IntendedSite", expectedOrg) : ""}
              {_("Warning_ClickedAd", sourceOrg)}
              {destOrg
                ? _("Warning_OperatedBy", destOrg)
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
            disabled={!target}
            className={`w-full py-2 px-4 rounded transition duration-200 ${
              target
                ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {_("Warning_Proceed")}
          </button>
        </div>
        {target && (
          <div className="mt-6 text-xs text-gray-400 break-all">
            {_("Warning_Destination")}
            {target}
          </div>
        )}
      </div>
    </div>
  );
}

export default Warning;
