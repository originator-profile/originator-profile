import { updateBadge } from "./update-badge";

/** バッジ更新のデバウンス時間（ミリ秒） */
const BADGE_UPDATE_DEBOUNCE_MS = 300;

/**
 * タブのバッジ更新の Service Worker 側イベント配線を登録する
 * @param countCredentials タブのバッジに表示するクレデンシャルの件数を数える
 */
export function setupTabBadge(
  countCredentials: (tabId: number) => Promise<number>,
) {
  async function updateTabBadge(tabId: number): Promise<void> {
    try {
      await updateBadge(tabId, await countCredentials(tabId));
    } catch (error) {
      console.error(
        `[updateTabBadge] Failed to update badge for tab ${tabId}:`,
        error,
      );
    }
  }

  // デバウンス用のタイマーID（タブIDごとに管理）
  const pendingBadgeUpdateTimers = new Map<
    number,
    ReturnType<typeof setTimeout>
  >();

  /** タブのバッジ更新をデバウンス付きで要求する */
  function requestTabBadgeUpdate(tabId: number): void {
    const existingTimer = pendingBadgeUpdateTimers.get(tabId);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      pendingBadgeUpdateTimers.delete(tabId);
      void updateTabBadge(tabId);
    }, BADGE_UPDATE_DEBOUNCE_MS);

    pendingBadgeUpdateTimers.set(tabId, timer);
  }

  // タブ切り替え時にバッジを更新
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    requestTabBadgeUpdate(tabId);
  });

  // ページ遷移完了時にバッジを更新（アクティブタブのみ）
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.active) {
      requestTabBadgeUpdate(tabId);
    }
  });

  // タブ削除時にデバウンスタイマーをクリーンアップ
  chrome.tabs.onRemoved.addListener((tabId) => {
    const timer = pendingBadgeUpdateTimers.get(tabId);
    if (timer !== undefined) {
      clearTimeout(timer);
      pendingBadgeUpdateTimers.delete(tabId);
    }
  });

  // NOTE: インストール直後の更新は Content Script の注入を待つ必要があるため、
  // onInstalled を分けずに呼び出し側から順序を保って呼ぶ
  return { requestTabBadgeUpdate };
}
