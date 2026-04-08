import { _ } from "@originator-profile/ui";
import { useSearchParams } from "react-router";
import Template from "../templates/Warning";
import { parseWarningSearchParams } from "../utils/warning-params";

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
function navigateBack(isNewTab: boolean, safeOriginal: string | null): void {
  if (isNewTab) {
    window.close();
    return;
  }
  if (safeOriginal) {
    // location.replace で遷移されるため履歴が置き換わる場合がある。
    // original パラメータ（広告クリック元ページのURL）があればそちらへ確実に戻る。
    window.location.replace(safeOriginal);
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
  safeOriginal: string | null,
): string {
  if (isNewTab) return _("Warning_CloseTab");
  if (safeOriginal || window.history.length > 1) return _("Warning_GoBack");
  return _("Warning_CloseTab");
}

export default function Warning() {
  const [searchParams] = useSearchParams();
  // NOTE: parseWarningSearchParams は reason も返すが、テンプレート側では
  // sourceOrg / destOrg / expectedOrg を組み合わせて詳細なメッセージを構築するため、
  // reason は表示に使用していない。
  const {
    target,
    sourceOrg,
    destOrg,
    expectedOrg,
    original,
    isNewTab: isNewTabParam,
  } = parseWarningSearchParams(searchParams);

  const safeTarget = target && isValidUrl(target) ? target : null;
  const safeOriginal = original && isValidUrl(original) ? original : null;
  const isNewTab = isNewTabParam ?? false;

  const handleProceed = () => {
    void (async () => {
      if (safeTarget) {
        try {
          // 検証状態をクリアして、次の onCompleted で再検証されないようにする
          await chrome.runtime.sendMessage({
            type: "clearPendingVerification",
          });
        } catch (error) {
          console.warn("Failed to notify background script:", error);
        } finally {
          // Navigate to the target URL regardless of message success
          window.location.replace(safeTarget);
        }
      }
    })();
  };

  return (
    <Template
      sourceOrg={sourceOrg}
      destOrg={destOrg}
      expectedOrg={expectedOrg}
      target={safeTarget}
      backButtonLabel={getBackButtonLabel(isNewTab, safeOriginal)}
      onBack={() => navigateBack(isNewTab, safeOriginal)}
      onProceed={handleProceed}
    />
  );
}
