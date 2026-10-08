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
export const siteProfileKey = (origin: string) =>
  `${SITE_PROFILE_PREFIX}${origin}`;
const tabKey = (tabId: number) => `${TAB_PREFIX}${tabId}`;

/** タブ内の文書 */
type TabIndex = {
  /** フレームごとに、いま読み込まれている文書 */
  frames: Record<number, string>;
  /** bfcache にある文書。復元されたら結果を再利用しうるため保持する */
  cached: string[];
  /** トップレベル文書 (bfcache にあるものを含む) のオリジン */
  origins: Record<string, string>;
};

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
  return {
    frames: {},
    cached: [],
    origins: {},
    ...(stored[key] as Partial<TabIndex> | undefined),
  };
}

async function removeDocuments(documentIds: string[]) {
  if (documentIds.length === 0) return;
  await chrome.storage.session.remove(documentIds.map(documentKey));
}

/** どのタブのトップレベル文書のオリジンでもなくなった Site Profile の結果を破棄する */
async function pruneSiteProfiles() {
  const stored = await chrome.storage.session.get(null);
  const origins = new Set(
    Object.entries(stored).flatMap(([key, value]) =>
      key.startsWith(TAB_PREFIX)
        ? Object.values((value as TabIndex).origins)
        : [],
    ),
  );
  const unused = Object.keys(stored).filter(
    (key) =>
      key.startsWith(SITE_PROFILE_PREFIX) &&
      !origins.has(key.slice(SITE_PROFILE_PREFIX.length)),
  );
  if (unused.length > 0) await chrome.storage.session.remove(unused);
}

/**
 * 破棄した文書を索引のオリジンからも外す
 * @returns トップレベル文書を外したか
 */
const forgetOrigins = (index: TabIndex, documentIds: string[]): boolean => {
  const topLevels = documentIds.filter((id) => id in index.origins);
  for (const id of topLevels) delete index.origins[id];
  return topLevels.length > 0;
};

const lifecycleOf = async (tabId: number, documentId: string) =>
  (await chrome.webNavigation.getFrame({ tabId, documentId }).catch(() => null))
    ?.documentLifecycle;

/**
 * 取り除かれたフレームの文書を索引から外す
 * @param frameId いま記録しようとしているフレーム。入れ替わりは呼び出し側で扱う
 * @returns 外した文書
 */
async function pruneRemovedFrames(
  tabId: number,
  index: TabIndex,
  frameId: number,
): Promise<string[]> {
  const live = new Set(
    ((await chrome.webNavigation.getAllFrames({ tabId })) ?? []).map(
      (frame) => frame.documentId,
    ),
  );
  const removed: string[] = [];
  for (const [id, tracked] of Object.entries(index.frames)) {
    if (Number(id) === frameId || live.has(tracked)) continue;
    delete index.frames[Number(id)];
    removed.push(tracked);
  }
  return removed;
}

/**
 * bfcache から追い出された文書を索引から外す
 * @param documentId いま記録しようとしている文書。復元されたものは bfcache から外す
 * @returns 外した文書
 */
async function pruneEvictedFromBfcache(
  tabId: number,
  index: TabIndex,
  documentId: string,
): Promise<string[]> {
  const cached = index.cached.filter((id) => id !== documentId);
  const stillCached = await Promise.all(
    cached.map(async (id) => (await lifecycleOf(tabId, id)) === "cached"),
  );
  index.cached = cached.filter((_, i) => stillCached[i]);
  return cached.filter((_, i) => !stillCached[i]);
}

/**
 * フレームから入れ替わった文書を、bfcache に残すか破棄するかに振り分ける
 *
 * bfcache に残すのはトップレベル文書だけ。サブフレームの文書は復元されたら
 * 検証し直す。
 * @returns 破棄する文書
 */
async function retire(
  tabId: number,
  frameId: number,
  index: TabIndex,
  previous: string,
): Promise<string[]> {
  if (frameId === 0 && (await lifecycleOf(tabId, previous)) === "cached") {
    index.cached.push(previous);
    return [];
  }
  return [previous];
}

/**
 * フレームに読み込まれている文書を記録し、結果を保持しなくてよい文書を破棄する
 *
 * 破棄するのは、入れ替わった文書・取り除かれたフレームの文書・bfcache から
 * 追い出された文書。トップレベル文書を破棄したら、どのタブでも使われなく
 * なったオリジンの Site Profile の結果も破棄する。
 * @returns 破棄した文書
 */
export function trackDocument(
  tabId: number,
  frameId: number,
  documentId: string,
  origin: string,
): Promise<string[]> {
  return serialize(async () => {
    const index = await getTabIndex(tabId);
    const isNewOrigin = frameId === 0 && index.origins[documentId] !== origin;
    if (frameId === 0) index.origins[documentId] = origin;
    const removed = await pruneRemovedFrames(tabId, index, frameId);

    const previous = index.frames[frameId];
    if (previous !== undefined && previous !== documentId) {
      removed.push(...(await retire(tabId, frameId, index, previous)));
    }
    index.frames[frameId] = documentId;
    removed.push(...(await pruneEvictedFromBfcache(tabId, index, documentId)));

    if (removed.length === 0 && previous === documentId && !isNewOrigin) {
      return [];
    }
    const removedTopLevel = forgetOrigins(index, removed);
    await chrome.storage.session.set({ [tabKey(tabId)]: index });
    await removeDocuments(removed);
    if (removedTopLevel) await pruneSiteProfiles();
    return removed;
  });
}

/**
 * タブの文書の結果をすべて破棄する
 * @returns 破棄した文書
 */
export function untrackTab(tabId: number): Promise<string[]> {
  return serialize(async () => {
    const index = await getTabIndex(tabId);
    const removed = [...Object.values(index.frames), ...index.cached];
    await chrome.storage.session.remove(tabKey(tabId));
    await removeDocuments(removed);
    await pruneSiteProfiles();
    return removed;
  });
}

/** 追い出す文書 */
type EvictionTarget = { tabId: number; documentId: string };

const isQuotaExceeded = (error: unknown) =>
  error instanceof Error && /quota/i.test(error.message);

/**
 * 容量が足りないときに追い出す文書を、追い出す順に組に分けて列挙する
 *
 * 表示中のタブの文書は、bfcache にあるものを除いて追い出さない。検証を
 * 求められた文書の結果が欠けると、表示が確定しなくなるため。
 */
async function listEvictable(): Promise<EvictionTarget[][]> {
  const stored = await chrome.storage.session.get(null);
  const active = new Set(
    (await chrome.tabs.query({ active: true })).map(({ id }) => id),
  );
  const subFrames: EvictionTarget[] = [];
  const cached: EvictionTarget[] = [];
  const topLevels: EvictionTarget[] = [];
  for (const [key, value] of Object.entries(stored)) {
    if (!key.startsWith(TAB_PREFIX)) continue;
    const tabId = Number(key.slice(TAB_PREFIX.length));
    const index = value as TabIndex;
    cached.push(...index.cached.map((documentId) => ({ tabId, documentId })));
    if (active.has(tabId)) continue;
    for (const [frameId, documentId] of Object.entries(index.frames)) {
      (frameId === "0" ? topLevels : subFrames).push({ tabId, documentId });
    }
  }
  return [subFrames, cached, topLevels].filter((group) => group.length > 0);
}

/** 文書の結果を追い出し、索引からも外す */
async function evict(targets: EvictionTarget[]) {
  const tabIds = [...new Set(targets.map(({ tabId }) => tabId))];
  await Promise.all(
    tabIds.map(async (tabId) => {
      const evicted = new Set(
        targets.flatMap((target) =>
          target.tabId === tabId ? [target.documentId] : [],
        ),
      );
      const index = await getTabIndex(tabId);
      const frames = Object.entries(index.frames).filter(
        ([, documentId]) => !evicted.has(documentId),
      );
      forgetOrigins(index, [...evicted]);
      await chrome.storage.session.set({
        [tabKey(tabId)]: {
          frames: Object.fromEntries(frames),
          cached: index.cached.filter((id) => !evicted.has(id)),
          origins: index.origins,
        } satisfies TabIndex,
      });
    }),
  );
  await removeDocuments(targets.map(({ documentId }) => documentId));
  await pruneSiteProfiles();
}

/**
 * 書き込む。容量が足りなければ、保持の優先度が低い文書から追い出して書き直す
 *
 * 追い出された文書は、表示されるときに検証を求められて検証し直される。
 * @param items 書き込む値
 * @param groups 追い出す文書の残り。省略すると列挙し直す
 */
async function setWithEviction(
  items: Record<string, unknown>,
  groups?: EvictionTarget[][],
): Promise<void> {
  try {
    await chrome.storage.session.set(items);
  } catch (error) {
    if (!isQuotaExceeded(error)) throw error;
    const [targets, ...rest] = groups ?? (await listEvictable());
    if (!targets) throw error;
    await evict(targets);
    await setWithEviction(items, rest);
  }
}

/**
 * 文書の検証の状態を書き込む
 *
 * 文書がすでにフレームから外れていれば書き込まない。fenced frame の結果は
 * 提示しないため保持しない。
 * @returns 書き込んだか
 */
export function setVerificationEntry(
  entry: VerificationEntry,
): Promise<boolean> {
  const { tabId, frameId, documentId, frameType } = entry.subject;
  if (frameType === "fenced_frame") return Promise.resolve(false);
  return serialize(async () => {
    const index = await getTabIndex(tabId);
    if (index.frames[frameId] !== documentId) return false;
    await setWithEviction({ [documentKey(documentId)]: entry });
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

/** オリジンの Site Profile の検証結果を書き込む */
export function setSiteProfileEntry(entry: SiteProfileEntry): Promise<void> {
  return serialize(() =>
    setWithEviction({ [siteProfileKey(entry.origin)]: entry }),
  );
}

export async function getSiteProfileEntry(
  origin: string,
): Promise<SiteProfileEntry | undefined> {
  const key = siteProfileKey(origin);
  const stored = await chrome.storage.session.get(key);
  return stored[key] as SiteProfileEntry | undefined;
}

export async function removeSiteProfileEntry(origin: string) {
  await chrome.storage.session.remove(siteProfileKey(origin));
}
