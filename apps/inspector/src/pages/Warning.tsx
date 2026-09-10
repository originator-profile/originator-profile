import { parseWarningSearchParams } from "@originator-profile/extension-common";
import { _ } from "@originator-profile/extension-common/ui";
import { useSearchParams } from "react-router";
import Template from "../templates/Warning";

const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

/**
 * 戻るボタンのナビゲーション処理
 */
function navigateBack(isNewTab: boolean, safeSource: string | null): void {
  if (isNewTab) {
    window.close();
    return;
  }
  if (safeSource) {
    // location.replace で遷移されるため履歴が置き換わる場合がある。
    // sourceUrl（リンク元ページの URL）があればそちらへ確実に戻る。
    window.location.replace(safeSource);
  } else if (window.history.length > 1) {
    window.history.back();
  } else {
    window.close();
  }
}

/**
 * 戻るボタンのラベルを決定する
 */
function getBackButtonLabel(
  isNewTab: boolean,
  safeSource: string | null,
): string {
  if (isNewTab) return _("Warning_CloseTab");
  if (safeSource || window.history.length > 1) return _("Warning_GoBack");
  return _("Warning_CloseTab");
}

export default function Warning() {
  const [searchParams] = useSearchParams();
  // NOTE: parseWarningSearchParams は reason も返すが、テンプレート側では
  // sourceOrg / expectedOrg / actualOrg を組み合わせて詳細なメッセージを
  // 構築するため、reason は表示に使用していない。
  const {
    destinationUrl,
    sourceOrg,
    expectedOrg,
    actualOrg,
    sourceUrl,
    isNewTab: isNewTabParam,
  } = parseWarningSearchParams(searchParams);

  const safeDestination =
    destinationUrl && isValidUrl(destinationUrl) ? destinationUrl : null;
  const safeSource = sourceUrl && isValidUrl(sourceUrl) ? sourceUrl : null;
  const isNewTab = isNewTabParam ?? false;

  const handleProceed = () => {
    void (async () => {
      if (safeDestination) {
        try {
          // 検証状態をクリアして、次の onCompleted で再検証されないようにする
          await chrome.runtime.sendMessage({
            type: "clearPendingVerification",
          });
        } catch (error) {
          console.warn("Failed to notify background script:", error);
        } finally {
          // Navigate to the destination regardless of message success
          window.location.replace(safeDestination);
        }
      }
    })();
  };

  return (
    <Template
      sourceOrg={sourceOrg}
      expectedOrg={expectedOrg}
      actualOrg={actualOrg}
      destinationUrl={safeDestination}
      backButtonLabel={getBackButtonLabel(isNewTab, safeSource)}
      onBack={() => navigateBack(isNewTab, safeSource)}
      onProceed={handleProceed}
    />
  );
}
