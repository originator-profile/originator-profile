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
                {isMatched ? "リンク先確認成功" : "リンク検証警告"}
            </h2>
            {!isMatched && (
                <>
                    <p className="text-sm mb-1">理由: {reason}</p>
                    <p className="text-sm text-xs font-mono">期待されるOPID: {expectedOpId}</p>
                </>
            )}
            {isMatched && <p className="text-sm">期待されるOPIDと一致しました。</p>}
        </div>
    );
}
