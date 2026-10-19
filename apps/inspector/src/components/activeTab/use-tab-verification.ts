import {
  requestTabVerification,
  tabVerificationStoreOf,
  topFrameOf,
  type TabVerificationSnapshot,
} from "@originator-profile/extension-common";
import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { matchPath, useLocation, useNavigate } from "react-router";
import { useSWRConfig } from "swr";
import { routes } from "../../utils/routes";
import { matchTabCacheKey } from "./match-tab-cache-key";

/**
 * タブが表示している文書群の検証の状態を購読する
 * @param tabId タブID
 */
export function useTabVerification(tabId: number): TabVerificationSnapshot {
  const store = tabVerificationStoreOf(tabId);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/**
 * タブの検証し直しを Service Worker に求める
 * @param tabId タブID
 */
export function reverifyTab(tabId: number) {
  return requestTabVerification(tabId, { force: true });
}

/**
 * 表示中のタブのトップレベル文書が入れ替わったら Base へ遷移する
 *
 * Router コンテキスト内で呼び出す必要がある。
 */
export function useDocumentNavigation() {
  const { mutate } = useSWRConfig();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tabId = Number(
    matchPath({ path: routes.base.path, end: false }, pathname)?.params.tabId,
  );

  const onDocumentChange = useEffectEvent(() => {
    void mutate(matchTabCacheKey(tabId), undefined);
    void navigate(routes.base.build({ tabId: String(tabId) }), {
      replace: true,
    });
  });

  useEffect(() => {
    if (Number.isNaN(tabId)) return;
    const store = tabVerificationStoreOf(tabId);
    const topDocumentId = () =>
      topFrameOf(store.getSnapshot().verification)?.frame.documentId;
    let current = topDocumentId();
    return store.subscribe(() => {
      const next = topDocumentId();
      if (next === undefined || next === current) return;
      const changed = current !== undefined;
      current = next;
      if (changed) onDocumentChange();
    });
  }, [tabId]);
}
