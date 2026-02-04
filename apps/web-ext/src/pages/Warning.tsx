import { useSearchParams } from "react-router";

const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

export default function Warning() {
  const [searchParams] = useSearchParams();
  const target = searchParams.get("target");
  const reason = searchParams.get("reason");
  const sourceOrg = searchParams.get("sourceOrg");
  const destOrg = searchParams.get("destOrg");

  const safeTarget = target && isValidUrl(target) ? target : null;
  const safeReason = reason?.slice(0, 500) ?? null;

  const handleProceed = async () => {
    if (safeTarget) {
      try {
        // Send message to background to allow navigation
        await chrome.runtime.sendMessage({
          type: "allowNavigation",
          url: safeTarget,
        });
      } catch (error) {
        // If message fails (e.g. background script suspended), log it but proceed anyway.
        // The user explicitly chose to proceed, so we shouldn't block them.
        console.warn("Failed to notify background script:", error);
      } finally {
        // Navigate to the target URL regardless of message success
        window.location.replace(safeTarget);
      }
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
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
        <h1 className="text-xl font-bold text-gray-800 mb-2">
          サイトの身元を確認できません
        </h1>
        <p className="text-gray-600 mb-6">
          {sourceOrg ? (
            <>
              {sourceOrg}の広告をクリックしましたが、
              {destOrg
                ? `リンク先は${destOrg}が運営しています。`
                : "リンク先のサイト運営者の確認ができませんでした。"}
            </>
          ) : (
            "予期されたOriginator Profile (OPID) と一致しませんでした。"
          )}
          {/* details/reason hidden as per user request */}
        </p>
        <div className="space-y-3">
          <button
            onClick={handleBack}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition duration-200"
          >
            {window.history.length > 1
              ? "前のページに戻る"
              : "このタブを閉じる"}
          </button>
          <button
            onClick={handleProceed}
            disabled={!safeTarget}
            className={`w-full py-2 px-4 rounded transition duration-200 ${safeTarget
              ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
          >
            このままアクセスする
          </button>
        </div>
        {safeTarget && (
          <div className="mt-6 text-xs text-gray-400 break-all">
            遷移先: {safeTarget}
          </div>
        )}
      </div>
    </div>
  );
}
