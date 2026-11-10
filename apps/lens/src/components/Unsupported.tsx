import { _ } from "@originator-profile/extension-common/ui";
import { linkVerificationTitle } from "./linkVerification/link-verification-title";
import { useLinkVerification } from "./linkVerification/use-link-verification";
import { AppBar } from "./sidepanel/AppBar";

// NOTE: getMessage は未定義のキーに空文字を返す。訳はエラーコードとは別々に
// 増えるため、訳の引けないコードとコードのないエラーは区別せず同じ文言にする。
function messageOf(code?: string): string {
  return (code && _(`Unsupported_${code}`)) || _("Unsupported_UnknownError");
}

function Messages({ codes }: { codes: (string | undefined)[] }) {
  // 別のコードでも同じ文言になることがあるため、重複を落とす
  const messages = [...new Set(codes.map(messageOf))];

  return (
    <ul className="list-disc list-inside text-sm max-w-xs mx-auto">
      {messages.map((message, index) => (
        <li key={index}>{message}</li>
      ))}
    </ul>
  );
}

type Props = {
  /** 未対応の理由のエラーコード。不明なら undefined */
  codes: (string | undefined)[];
};

function Unsupported({ codes }: Props) {
  const verificationResult = useLinkVerification();
  const hasLinkVerification =
    verificationResult &&
    verificationResult.status !== "none" &&
    verificationResult.status !== "matched";

  const title = linkVerificationTitle(verificationResult?.status);

  return (
    <>
      <AppBar />
      <main className="min-h-screen bg-gray-100 overflow-y-auto px-4 py-6">
        <div className="mb-12 max-w-sm mx-auto">
          <div className="flex flex-col items-center justify-center gap-2 mb-4">
            <h1 className="whitespace-pre-line text-lg text-center font-bold">
              {_("Unsupported_OpNotSupported")}
            </h1>
            {hasLinkVerification && (
              <p className="flex items-center flex-col gap-4 mt-2 mb-2">
                <span className="whitespace-pre-line text-red-700 text-sm tracking-normal text-center w-auto inline-block align-middle">
                  {title}
                </span>
              </p>
            )}
          </div>
          <div
            className="whitespace-pre-line text-sm text-gray-700 text-center mb-2"
            data-testid="p-elm-unsupported-message"
          >
            <Messages codes={codes} />
          </div>
          <p className="text-sm text-center underline">
            <a
              href="https://originator-profile.org/"
              target="_blank"
              rel="noreferrer noopener"
            >
              {_("Link_OriginatorProfile")}
            </a>
          </p>
        </div>
      </main>
    </>
  );
}

export default Unsupported;
