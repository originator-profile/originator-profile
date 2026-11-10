import type { OrganizationDetail } from "../view";

const keyOf = (id: string) => `lens:organization-detail:${id}`;
/** 詳細を開いたウインドウと、保存した詳細の識別子の対応 */
const windowKeyOf = (windowId: number) =>
  `lens:organization-detail-window:${windowId}`;

/**
 * 組織の詳細を保存する
 *
 * 詳細のウインドウは、元のタブがほかのページへ移っても表示を保つ。そのため
 * タブの検証の状態を読み直さず、開いた時点の内容を保存して渡す。
 * @returns 保存した詳細の識別子
 */
export async function saveDetail(detail: OrganizationDetail): Promise<string> {
  const id = crypto.randomUUID();
  await chrome.storage.session.set({ [keyOf(id)]: detail });
  return id;
}

/** 保存した組織の詳細を読む */
export async function loadDetail(
  id: string,
): Promise<OrganizationDetail | undefined> {
  const key = keyOf(id);
  const stored = await chrome.storage.session.get(key);
  return stored[key] as OrganizationDetail | undefined;
}

/** 組織の詳細を別ウインドウで開く */
export async function openDetail(detail: OrganizationDetail) {
  const id = await saveDetail(detail);
  const created = await chrome.windows.create({
    url: chrome.runtime.getURL(`index.html#/detail/${id}`),
    type: "popup",
    width: 480,
    height: 720,
  });
  if (created?.id !== undefined) {
    await chrome.storage.session.set({ [windowKeyOf(created.id)]: id });
  }
}

/**
 * 詳細のウインドウを閉じたら、保存した詳細を消す (Service Worker で呼ぶ)
 *
 * NOTE: 保存した詳細は検証結果と同じ chrome.storage.session の容量を使う。
 * 残し続けると、容量が足りないときに検証結果のほうが追い出される
 */
export function setupDetailCleanup() {
  chrome.windows.onRemoved.addListener(async (windowId) => {
    const windowKey = windowKeyOf(windowId);
    const { [windowKey]: id } = await chrome.storage.session.get(windowKey);
    if (typeof id !== "string") return;
    await chrome.storage.session.remove([windowKey, keyOf(id)]);
  });
}
