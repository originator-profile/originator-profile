import { useEffect, useEffectEvent, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSWRConfig } from "swr";
import { routes } from "../../utils/routes";
import { activeTabMessenger } from "./events";

/** タイムアウト（ミリ秒）: 全サブフレームの readiness を待つ上限 */
const ALL_FRAMES_TIMEOUT_MS = 3000;

type PendingFrames = {
  /** 期待フレーム一覧。null は getAllFrames 完了前（未確定）を示す */
  expected: Set<number> | null;
  received: Set<number>;
  timer: ReturnType<typeof setTimeout>;
};

function clearPending(
  pendings: Map<number, PendingFrames>,
  tabId: number,
): void {
  const pending = pendings.get(tabId);
  if (pending) {
    clearTimeout(pending.timer);
    pendings.delete(tabId);
  }
}

async function getExpectedFrameIds(tabId: number): Promise<Set<number>> {
  const allFrames = (await chrome.webNavigation.getAllFrames({ tabId })) ?? [];
  return new Set(
    allFrames.filter((f) => /^https?:/.test(f.url)).map((f) => f.frameId),
  );
}

/**
 * 同一タブ内のページ遷移を検知し、SWR キャッシュをクリアして再取得する。
 *
 * Content Script が DOMContentLoaded 後に送信する `contentReady` メッセージを受信し、
 * 全フレームの準備完了を確認してからキャッシュクリア + Base への遷移をおこなう。
 *
 * Router コンテキスト内で呼び出す必要がある。
 */
export function useNavigationRefetch() {
  const { mutate } = useSWRConfig();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pendingRef = useRef<Map<number, PendingFrames>>(new Map());

  const triggerRefetch = useEffectEvent((tabId: number) => {
    clearPending(pendingRef.current, tabId);
    const base = routes.base.build({ tabId: String(tabId) });
    void mutate((key) => Array.isArray(key) && key[1] === tabId, undefined);
    void navigate(base, { replace: true });
  });

  const isCurrentTab = useEffectEvent((tabId: number) => {
    const currentBase = routes.base.build({ tabId: String(tabId) });
    return pathname.startsWith(currentBase);
  });

  useEffect(() => {
    const pendings = pendingRef.current;

    const checkAllReady = (pending: PendingFrames) =>
      pending.expected !== null &&
      [...pending.expected].every((id) => pending.received.has(id));

    const handleMainFrame = async (tabId: number) => {
      clearPending(pendings, tabId);

      // await 中に到着するサブフレームの contentReady を received に蓄積するため
      // expected: null（未確定）で仮の pending エントリを先に設定する
      const pending: PendingFrames = {
        expected: null,
        received: new Set([0]),
        timer: setTimeout(() => triggerRefetch(tabId), ALL_FRAMES_TIMEOUT_MS),
      };
      pendings.set(tabId, pending);

      const expectedFrameIds = await getExpectedFrameIds(tabId);
      if (expectedFrameIds.size <= 1) {
        triggerRefetch(tabId);
        return;
      }

      pending.expected = expectedFrameIds;

      // await 中に全フレームが ready になっていた場合
      if (checkAllReady(pending)) {
        triggerRefetch(tabId);
      }
    };

    const handleSubFrame = (tabId: number, frameId: number) => {
      const pending = pendings.get(tabId);
      if (!pending) return;
      pending.received.add(frameId);

      // expected が未確定（getAllFrames 完了前）なら蓄積のみ
      if (checkAllReady(pending)) {
        triggerRefetch(tabId);
      }
    };

    const cleanup = activeTabMessenger.onMessage(
      "contentReady",
      ({ sender }) => {
        const tabId = sender.tab?.id;
        const frameId = sender.frameId;
        if (tabId === undefined || frameId === undefined) return;
        if (!isCurrentTab(tabId)) return;

        if (frameId === 0) {
          void handleMainFrame(tabId);
        } else {
          handleSubFrame(tabId, frameId);
        }
      },
    );

    return () => {
      cleanup();
      for (const pending of pendings.values()) {
        clearTimeout(pending.timer);
      }
      pendings.clear();
    };
  }, []);
}
