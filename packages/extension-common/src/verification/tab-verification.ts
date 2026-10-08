import { getAllFrames } from "../utils/frames";
import { verificationMessenger } from "./events";
import { resolveEntry } from "./identity";
import { documentKey, siteProfileKey } from "./store";
import type { SiteProfileEntry, VerificationEntry } from "./types";

/** フレームに読み込まれている文書と、その検証の状態 */
export type FrameVerification = {
  frame: chrome.webNavigation.GetAllFrameResultDetails;
  /** まだ検証の通知を受けていない文書では undefined */
  entry?: VerificationEntry;
};

/** タブが表示している文書群の検証の状態 */
export type TabVerification = {
  /** フレームごとの検証の状態。getAllFrames の順 */
  frames: FrameVerification[];
  /** トップレベル文書のオリジンの Site Profile の検証結果 */
  siteProfile?: SiteProfileEntry;
};

/**
 * タブが表示している文書群の検証の状態を読む
 *
 * 表示中の文書の documentId と一致する結果だけを返す。
 * @param tabId タブID
 */
export async function readTabVerification(
  tabId: number,
): Promise<TabVerification> {
  const frames = await getAllFrames(tabId);
  const top = frames.find(({ frameType }) => frameType === "outermost_frame");
  const keys = frames.map(({ documentId }) => documentKey(documentId));
  if (top) keys.push(siteProfileKey(top.documentId));
  const stored = keys.length > 0 ? await chrome.storage.session.get(keys) : {};

  const now = new Date();
  return {
    frames: frames.map((frame) => {
      const entry = stored[documentKey(frame.documentId)] as
        | VerificationEntry
        | undefined;
      return { frame, entry: entry && resolveEntry(entry, now) };
    }),
    siteProfile: top
      ? (stored[siteProfileKey(top.documentId)] as SiteProfileEntry | undefined)
      : undefined,
  };
}

/**
 * タブが表示している文書群の検証の状態の変化を購読する
 * @param tabId タブID
 * @param onChange 状態が変わるたびに呼ばれる。読み出しに失敗したらエラーを渡す
 * @returns 購読の解除
 */
export function watchTabVerification(
  tabId: number,
  onChange: (verification: TabVerification | Error) => void,
): () => void {
  let disposed = false;
  let scheduled = false;
  const update = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      readTabVerification(tabId).then(
        (verification) => !disposed && onChange(verification),
        (error: unknown) =>
          !disposed &&
          onChange(error instanceof Error ? error : new Error(String(error))),
      );
    });
  };

  const onStorageChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== "session") return;
    if (Object.keys(changes).some((key) => key.startsWith("verification:"))) {
      update();
    }
  };
  const onNavigation = (details: { tabId: number }) => {
    if (details.tabId === tabId) update();
  };
  const navigationEvents = [
    chrome.webNavigation.onCommitted,
    chrome.webNavigation.onDOMContentLoaded,
    chrome.webNavigation.onCompleted,
  ];

  chrome.storage.onChanged.addListener(onStorageChanged);
  for (const event of navigationEvents) event.addListener(onNavigation);
  update();

  return () => {
    disposed = true;
    chrome.storage.onChanged.removeListener(onStorageChanged);
    for (const event of navigationEvents) event.removeListener(onNavigation);
  };
}

/**
 * タブ内の文書の検証を Service Worker に求める
 * @param tabId タブID
 * @param options.force 保持している結果を再利用せずに検証し直すか
 * @returns 検証を求められた (content script に到達できた) 文書と、タブが読み込み中か
 */
export function requestTabVerification(
  tabId: number,
  options: { force?: boolean } = {},
): Promise<{ reachable: string[]; loading: boolean }> {
  return verificationMessenger.sendMessage("verifyTab", {
    tabId,
    force: options.force ?? false,
  });
}
