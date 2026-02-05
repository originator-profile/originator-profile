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
        {result.destinationOrgName
          ? `${result.destinationOrgName}のサイトを開くことを意図した`
          : ""}
        {result.sourceOrgName ? `${result.sourceOrgName}の` : ""}
        広告をクリックし、正しいリンク先に遷移したことを確認できました
      </p>
    );
  }

  return (
    <p className="text-sm mb-1">
      {result.expectedOrgName
        ? `${result.expectedOrgName}のサイトを開くことを意図した`
        : ""}
      {result.sourceOrgName ? `${result.sourceOrgName}の` : ""}
      広告をクリックしましたが、
      {result.destinationOrgName
        ? `リンク先は${result.destinationOrgName}が運営しています。`
        : "リンク先のサイト運営者の確認ができませんでした。"}
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
        {isMatched ? "リンク先確認成功" : "サイトの身元を確認できません"}
      </h2>
      <VerificationMessage result={verificationResult} isMatched={isMatched} />
    </div>
  );
}
