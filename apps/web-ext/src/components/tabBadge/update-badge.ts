/**
 * タブのバッジテキストを更新する
 * @param tabId タブID
 * @param count CAS件数
 */
export async function updateBadge(tabId: number, count: number): Promise<void> {
  const text = count === 0 ? "" : count > 99 ? "99+" : String(count);

  await chrome.action.setBadgeText({ text, tabId });
  await chrome.action.setBadgeBackgroundColor({
    color: "#4CAF50",
    tabId,
  });
}
