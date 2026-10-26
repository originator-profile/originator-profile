/**
 * マニフェストの content script を、既存の文書に注入する
 *
 * 注入できない文書 (拡張機能が読めないページなど) は飛ばす。同じ文書に
 * 2 度注入されても、content script のセットアップは 1 度だけおこなわれる。
 */

/**
 * タブの指定したフレームの文書に注入する
 * @param tabId タブID
 * @param frameIds 注入するフレーム。最上位フレームだけに注入する content script は
 *   frameId 0 が含まれるときだけ注入する
 */
export async function injectContentScripts(
  tabId: number,
  frameIds: number[],
): Promise<void> {
  const manifest = chrome.runtime.getManifest();
  const injections = (manifest.content_scripts ?? []).flatMap(
    ({ js: files, all_frames: allFrames }) => {
      if (!files || files.length === 0) return [];
      return frameIds
        .filter((frameId) => allFrames || frameId === 0)
        .map((frameId) =>
          chrome.scripting
            .executeScript({ target: { tabId, frameIds: [frameId] }, files })
            .catch(() => {
              // 注入できない文書はスキップ
            }),
        );
    },
  );
  await Promise.all(injections);
}

/** Web ページを表示している既存のタブすべてに注入する */
export async function injectContentScriptsToExistingTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const injectableTabs = tabs.filter(
    (tab): tab is chrome.tabs.Tab & { id: number } =>
      tab.id !== undefined &&
      tab.url !== undefined &&
      /^https?:\/\//.test(tab.url),
  );
  await Promise.all(
    injectableTabs.map(async ({ id: tabId }) => {
      const frames = (await chrome.webNavigation.getAllFrames({ tabId })) ?? [];
      await injectContentScripts(
        tabId,
        frames.map(({ frameId }) => frameId),
      );
    }),
  );
}
