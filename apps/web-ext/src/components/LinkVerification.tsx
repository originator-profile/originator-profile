import { _ } from "@originator-profile/ui";
import { useLinkVerification } from "./credentials/use-link-verification";

export default function LinkVerification({ inline = false }: { inline?: boolean }) {
  const verificationResult = useLinkVerification();

  if (!verificationResult || verificationResult.status === "none") {
    return null;
  }

  const { status } = verificationResult;
  const isMatched = status === "matched";
  const titleKey = isMatched
    ? "LinkVerification_Matched_Title"
    : status === "mismatched"
      ? "LinkVerification_Mismatched_Title"
      : "LinkVerification_MissingOpid_Title";

  if (inline) {
    return (
      <div className="relative flex flex-col items-center mt-1">
        <span
          className={`font-bold text-xs ${isMatched
            ? "text-green-700"
            : "text-red-700"
            }`}
        >
          {_(titleKey)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`mb-3 text-left w-full ${isMatched
        ? "text-green-700"
        : "text-red-700"
        }`}
    >
      <h2 className="font-bold text-sm">
        {_(titleKey)}
      </h2>
    </div>
  );
}
