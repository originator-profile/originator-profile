import { _ } from "@originator-profile/ui";
import { useLinkVerification } from "./credentials/use-link-verification";

type VerificationResult = NonNullable<ReturnType<typeof useLinkVerification>>;

function VerificationMessage({
  result,
  isMatched,
}: {
  result: VerificationResult;
  isMatched: boolean;
}) {
  if (isMatched) {
    return (
      <p className="text-sm">
        {result.expectedOrgName
          ? _("LinkVerification_Matched_IntendedSite", result.expectedOrgName)
          : ""}
        {result.sourceOrgName
          ? _("LinkVerification_Matched_ClickedAd", result.sourceOrgName)
          : _("LinkVerification_Matched_ClickedAdGeneric")}
        {result.destinationOrgName
          ? _(
              "LinkVerification_Matched_DestConfirmed",
              result.destinationOrgName,
            )
          : _("LinkVerification_Matched_Confirmed")}
      </p>
    );
  }

  return (
    <p className="text-sm mb-1">
      {result.expectedOrgName
        ? _("LinkVerification_Mismatched_IntendedSite", result.expectedOrgName)
        : ""}
      {result.sourceOrgName
        ? _("LinkVerification_Mismatched_ClickedAd", result.sourceOrgName)
        : _("LinkVerification_Mismatched_ClickedAdGeneric")}
      {result.destinationOrgName
        ? _("LinkVerification_Mismatched_OperatedBy", result.destinationOrgName)
        : _("LinkVerification_Mismatched_CannotVerify")}
    </p>
  );
}

export default function LinkVerification() {
  const verificationResult = useLinkVerification();

  if (!verificationResult || verificationResult.status === "none") {
    return null;
  }

  const { status } = verificationResult;
  const isMatched = status === "matched";

  return (
    <div
      className={`p-4 border-b ${
        isMatched
          ? "bg-green-50 border-green-200 text-green-800"
          : "bg-red-50 border-red-200 text-red-800"
      }`}
    >
      <h2 className="font-bold mb-1">
        {isMatched
          ? _("LinkVerification_Matched_Title")
          : _("LinkVerification_Mismatched_Title")}
      </h2>
      <VerificationMessage result={verificationResult} isMatched={isMatched} />
    </div>
  );
}
