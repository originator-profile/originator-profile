import { readTabVerification } from "../verification/tab-verification";
import type { TabVerification, VerificationEntry } from "../verification/types";
import { updateBadge } from "./update-badge";

/**
 * 検証結果ストアの変化を受けてタブのバッジを更新する
 * @param countCredentials タブのバッジに表示するクレデンシャルの件数を数える
 */
export function setupTabBadge(
  countCredentials: (verification: TabVerification) => number,
) {
  async function updateTabBadge(tabId: number): Promise<void> {
    try {
      const verification = await readTabVerification(tabId);
      await updateBadge(tabId, countCredentials(verification));
    } catch (error) {
      console.error(
        `[updateTabBadge] Failed to update badge for tab ${tabId}:`,
        error,
      );
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "session") return;
    const tabIds = new Set(
      Object.entries(changes).flatMap(([key, { newValue }]) =>
        key.startsWith("verification:document:") && newValue
          ? [(newValue as VerificationEntry).subject.tabId]
          : [],
      ),
    );
    for (const tabId of tabIds) void updateTabBadge(tabId);
  });
}
