// 許可されたナビゲーションのメモリ内ストレージ
// キー形式: `${tabId}:${url}`
const allowedNavigations: { [key: string]: boolean } = {};

const getAllowedKey = (tabId: number, url: string) => `${tabId}:${url}`;

/**
 * 特定のタブとURLのナビゲーションを許可
 * 1回のみ有効（使用時に消費）
 */
export const allowNavigation = (tabId: number, url: string): void => {
  const key = getAllowedKey(tabId, url);
  allowedNavigations[key] = true;
};

/**
 * ナビゲーションが許可されているかを確認し、存在する場合は許可を消費（削除）
 * @returns ナビゲーションが許可され、消費された場合は true、それ以外は false
 */
export const consumeAllowedNavigation = async (
  tabId: number,
  url: string,
): Promise<boolean> => {
  const key = getAllowedKey(tabId, url);
  const lockName = `nav-lock:${key}`;

  // navigator.locks を使用して、複数のフレーム/タブが同時に同じキーを確認することによる競合状態を防ぐ
  return navigator.locks.request(lockName, async () => {
    if (allowedNavigations[key]) {
      delete allowedNavigations[key];
      return true;
    }
    return false;
  });
};

/**
 * 特定のタブの許可されたナビゲーション状態を削除
 */
export const cleanupNavigationState = (tabId: number): void => {
  const prefix = `${tabId}:`;
  Object.keys(allowedNavigations).forEach((key) => {
    if (key.startsWith(prefix)) {
      delete allowedNavigations[key];
    }
  });
};
