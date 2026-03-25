import { _ } from "@originator-profile/ui";

const WarningIcon = () => {
  return (
    <div className="mb-4 text-red-500">
      <svg
        className="w-16 h-16 mx-auto"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    </div>
  );
};

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
        <WarningIcon />
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
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition duration-200"
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
