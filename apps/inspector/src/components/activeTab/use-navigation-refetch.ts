import { useEffect, useEffectEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSWRConfig } from "swr";
import { routes } from "../../utils/routes";
import { activeTabMessenger } from "./events";
import { createFrameReadinessTracker } from "./frame-readiness-tracker";
import { matchTabCacheKey } from "./match-tab-cache-key";

async function getExpectedFrameIds(tabId: number): Promise<Set<number>> {
  try {
    const allFrames =
      (await chrome.webNavigation.getAllFrames({ tabId })) ?? [];
    return new Set(
      allFrames.filter((f) => /^https?:/.test(f.url)).map((f) => f.frameId),
    );
  } catch {
    // タブが閉じられた場合などはメインフレームのみとして扱う
    return new Set([0]);
  }
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

  const onRefetch = useEffectEvent((tabId: number) => {
    const base = routes.base.build({ tabId: String(tabId) });
    void mutate(matchTabCacheKey(tabId), undefined);
    void navigate(base, { replace: true });
  });

  const isCurrentTab = useEffectEvent((tabId: number) => {
    const currentBase = routes.base.build({ tabId: String(tabId) });
    return pathname.startsWith(currentBase);
  });

  useEffect(() => {
    const tracker = createFrameReadinessTracker(onRefetch);

    // タブが閉じられたときに pendings をクリーンアップ
    const removedListener = (tabId: number) => {
      tracker.removeTab(tabId);
    };
    chrome.tabs.onRemoved.addListener(removedListener);

    const cleanup = activeTabMessenger.onMessage(
      "contentReady",
      ({ sender }) => {
        const tabId = sender.tab?.id;
        const frameId = sender.frameId;
        if (tabId === undefined || frameId === undefined) return;

        const result = tracker.handleContentReady(
          tabId,
          frameId,
          isCurrentTab(tabId),
        );

        if (result === "pending" && frameId === 0) {
          void getExpectedFrameIds(tabId).then((frameIds) => {
            tracker.resolveExpectedFrames(tabId, frameIds);
          });
        }
      },
    );

    return () => {
      cleanup();
      chrome.tabs.onRemoved.removeListener(removedListener);
      tracker.dispose();
    };
  }, []);
}
