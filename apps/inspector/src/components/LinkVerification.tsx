import { linkVerificationTitle } from "./credentials/link-verification-title";
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

  return (
    <span
      className={`font-bold text-xs ${
        isMatched ? "text-green-700" : "text-red-700"
      } ${className ?? ""}`}
    >
      {linkVerificationTitle(status)}
    </span>
  );
}
