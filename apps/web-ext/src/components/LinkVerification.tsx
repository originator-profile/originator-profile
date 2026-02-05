import { useLinkVerification } from "./credentials/use-link-verification";

export default function LinkVerification() {
  const verificationResult = useLinkVerification();

  if (!verificationResult || verificationResult.status === "none") {
    return null;
  }

  const { status, reason, expectedOpId } = verificationResult;
  const isMatched = status === "matched";

  return (
    <div
      className={`p-4 border-b ${isMatched
        ? "bg-green-50 border-green-200 text-green-800"
        : "bg-red-50 border-red-200 text-red-800"
        }`}
    >
      <h2 className="font-bold mb-1">
        {isMatched ? "リンク先確認成功" : "サイトの身元を確認できません"}
      </h2>
      {!isMatched && (
        <p className="text-sm mb-1">
          {verificationResult.expectedOrgName
            ? `${verificationResult.expectedOrgName}のサイトを開くことを意図した`
            : ""}
          {verificationResult.sourceOrgName
            ? `${verificationResult.sourceOrgName}の`
            : ""}
          広告をクリックしましたが、
          {verificationResult.destinationOrgName
            ? `リンク先は${verificationResult.destinationOrgName}が運営しています。`
            : "リンク先のサイト運営者の確認ができませんでした。"}
        </p>
      )}

      {
        isMatched && (
          <p className="text-sm">
            {verificationResult.destinationOrgName
              ? `${verificationResult.destinationOrgName}のサイトを開くことを意図した`
              : ""}
            {verificationResult.sourceOrgName
              ? `${verificationResult.sourceOrgName}の`
              : ""}
            広告をクリックし、正しいリンク先に遷移したことを確認できました
          </p>
        )
      }
    </div >
  );
}
