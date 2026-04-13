import { _ } from "@originator-profile/ui";
import { useLinkVerification } from "./credentials/use-link-verification";

export default function LinkVerification({
  className,
}: {
  className?: string;
}) {
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

  return (
    <span
      className={`font-bold text-xs ${
        isMatched ? "text-green-700" : "text-red-700"
      } ${className ?? ""}`}
    >
      {_(titleKey)}
    </span>
  );
}
