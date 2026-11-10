import type { OrganizationDetail } from "../view";

const keyOf = (id: string) => `lens:organization-detail:${id}`;

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
  await chrome.windows.create({
    url: chrome.runtime.getURL(`index.html#/detail/${id}`),
    type: "popup",
    width: 480,
    height: 720,
  });
}
