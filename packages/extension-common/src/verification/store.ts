import type { SiteProfileEntry, VerificationEntry } from "./types";

/**
 * 検証結果ストア
 *
 * 文書ごとに別のキーで chrome.storage.session に置く。書き込みも
 * storage.onChanged の通知も文書単位で済む。
 */

const DOCUMENT_PREFIX = "verification:document:";
const SITE_PROFILE_PREFIX = "verification:site-profile:";
const TAB_PREFIX = "verification:tab:";

export const documentKey = (documentId: string) =>
  `${DOCUMENT_PREFIX}${documentId}`;
export const siteProfileKey = (documentId: string) =>
  `${SITE_PROFILE_PREFIX}${documentId}`;
const tabKey = (tabId: number) => `${TAB_PREFIX}${tabId}`;

/** タブ内のフレームごとに、いま読み込まれている文書 */
type TabIndex = Record<number, string>;

// NOTE: 索引の読み書きは非同期のため、直列化しないと別のフレームの更新を
// 上書きしうる。エントリの書き込みも索引の確認と不可分にするため同じ列に並べる。
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

async function getTabIndex(tabId: number): Promise<TabIndex> {
  const key = tabKey(tabId);
  const stored = await chrome.storage.session.get(key);
  return (stored[key] as TabIndex | undefined) ?? {};
}

async function removeDocuments(documentIds: string[]) {
  if (documentIds.length === 0) return;
  await chrome.storage.session.remove(
    documentIds.flatMap((id) => [documentKey(id), siteProfileKey(id)]),
  );
}

/**
 * フレームに読み込まれている文書を記録し、入れ替わった文書の結果を破棄する
 * @returns 破棄した文書
 */
export function trackDocument(
  tabId: number,
  frameId: number,
  documentId: string,
): Promise<string[]> {
  return serialize(async () => {
    const index = await getTabIndex(tabId);
    const previous = index[frameId];
    if (previous === documentId) return [];

    index[frameId] = documentId;
    await chrome.storage.session.set({ [tabKey(tabId)]: index });
    const removed = previous === undefined ? [] : [previous];
    await removeDocuments(removed);
    return removed;
  });
}

/**
 * タブの文書の結果をすべて破棄する
 * @returns 破棄した文書
 */
export function untrackTab(tabId: number): Promise<string[]> {
  return serialize(async () => {
    const removed = Object.values(await getTabIndex(tabId));
    await chrome.storage.session.remove(tabKey(tabId));
    await removeDocuments(removed);
    return removed;
  });
}

/**
 * 文書の検証の状態を書き込む。文書がすでにフレームから外れていれば書き込まない
 * @returns 書き込んだか
 */
export function setVerificationEntry(
  entry: VerificationEntry,
): Promise<boolean> {
  const { tabId, frameId, documentId } = entry.subject;
  return serialize(async () => {
    const index = await getTabIndex(tabId);
    if (index[frameId] !== documentId) return false;
    await chrome.storage.session.set({ [documentKey(documentId)]: entry });
    return true;
  });
}

export async function getVerificationEntry(
  documentId: string,
): Promise<VerificationEntry | undefined> {
  const key = documentKey(documentId);
  const stored = await chrome.storage.session.get(key);
  return stored[key] as VerificationEntry | undefined;
}

/** 保持しているすべての文書の検証の状態 */
export async function listVerificationEntries(): Promise<VerificationEntry[]> {
  const stored = await chrome.storage.session.get(null);
  return Object.entries(stored).flatMap(([key, value]) =>
    key.startsWith(DOCUMENT_PREFIX) ? [value as VerificationEntry] : [],
  );
}

/**
 * Site Profile の検証結果を書き込む
 * @param tabId 文書を表示しているタブ
 * @param entry 検証結果
 */
export function setSiteProfileEntry(
  tabId: number,
  entry: SiteProfileEntry,
): Promise<boolean> {
  return serialize(async () => {
    const index = await getTabIndex(tabId);
    if (!Object.values(index).includes(entry.documentId)) return false;
    await chrome.storage.session.set({
      [siteProfileKey(entry.documentId)]: entry,
    });
    return true;
  });
}

export async function getSiteProfileEntry(
  documentId: string,
): Promise<SiteProfileEntry | undefined> {
  const key = siteProfileKey(documentId);
  const stored = await chrome.storage.session.get(key);
  return stored[key] as SiteProfileEntry | undefined;
}
