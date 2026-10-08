import {
  requestTabVerification,
  watchTabVerification,
  type FrameVerification,
  type TabVerification,
} from "@originator-profile/extension-common";
import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { matchPath, useLocation, useNavigate } from "react-router";
import { useSWRConfig } from "swr";
import { routes } from "../../utils/routes";
import { matchTabCacheKey } from "./match-tab-cache-key";

/** タブの検証の状態 */
export type TabVerificationSnapshot = {
  verification?: TabVerification;
  /** 検証を求めた時点で content script に到達できた文書。問い合わせ中は undefined */
  reachable?: string[];
  /** 検証を求めた時点でタブが読み込み中だったか */
  loading?: boolean;
  /** 状態を読み出せなかった */
  error?: Error;
};

type Store = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => TabVerificationSnapshot;
};

const topDocumentIdOf = (verification?: TabVerification) =>
  verification?.frames.find(
    ({ frame }) => frame.frameType === "outermost_frame",
  )?.frame.documentId;

/** トップレベル文書の検証の状態 */
export const topFrameOf = (
  snapshot: TabVerificationSnapshot,
): FrameVerification | undefined =>
  snapshot.verification?.frames.find(
    ({ frame }) => frame.frameType === "outermost_frame",
  );

function createStore(tabId: number): Store {
  let snapshot: TabVerificationSnapshot = {};
  let dispose: (() => void) | undefined;
  const listeners = new Set<() => void>();

  const update = (patch: TabVerificationSnapshot) => {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };
  let requesting = false;
  /** トップレベル文書が入れ替わるたびに進める。古い文書への応答を捨てるのに使う */
  let generation = 0;
  const request = () => {
    if (requesting) return;
    requesting = true;
    const sent = generation;
    requestTabVerification(tabId)
      .then(
        ({ reachable, loading }) =>
          sent === generation && update({ reachable, loading }),
        (error: unknown) =>
          update({
            error: error instanceof Error ? error : new Error(String(error)),
          }),
      )
      .finally(() => {
        requesting = false;
        if (sent !== generation) request();
      });
  };

  const start = () => {
    request();
    dispose = watchTabVerification(tabId, (verification) => {
      if (verification instanceof Error) return update({ error: verification });
      // 別の文書に遷移したら、到達できるフレームを問い合わせ直す
      const previous = topDocumentIdOf(snapshot.verification);
      if (previous && previous !== topDocumentIdOf(verification)) {
        generation++;
        update({ reachable: undefined, loading: undefined });
      }
      update({ verification, error: undefined });
      // NOTE: 遷移の直後は遷移先の content script がまだ応答できない。
      // 読み込みを終えたタブで到達できないと分かったら、問い合わせ直さない
      const top = topFrameOf(snapshot);
      const undetermined =
        snapshot.reachable === undefined || snapshot.loading === true;
      if (
        top &&
        !top.entry &&
        undetermined &&
        !snapshot.reachable?.includes(top.frame.documentId)
      ) {
        request();
      }
    });
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        dispose?.();
        snapshot = {};
      };
    },
    getSnapshot: () => snapshot,
  };
}

const stores = new Map<number, Store>();
chrome.tabs.onRemoved.addListener((tabId) => stores.delete(tabId));
const storeOf = (tabId: number): Store => {
  const store = stores.get(tabId) ?? createStore(tabId);
  stores.set(tabId, store);
  return store;
};

/**
 * タブが表示している文書群の検証の状態を購読する
 * @param tabId タブID
 */
export function useTabVerification(tabId: number): TabVerificationSnapshot {
  const store = storeOf(tabId);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/**
 * トップレベル文書に到達できないか
 *
 * 検証結果を持つ文書には到達できている。読み込み中のタブでは content script が
 * まだ応答できないことがあるため、到達できないとは決めない。
 */
export function isTopFrameUnreachable(snapshot: TabVerificationSnapshot) {
  if (snapshot.error) return true;
  if (!snapshot.verification) return false;
  const top = topFrameOf(snapshot);
  if (!top) return true;
  if (top.entry || snapshot.reachable === undefined || snapshot.loading) {
    return false;
  }
  return !snapshot.reachable.includes(top.frame.documentId);
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
    const store = storeOf(tabId);
    let current = topDocumentIdOf(store.getSnapshot().verification);
    return store.subscribe(() => {
      const next = topDocumentIdOf(store.getSnapshot().verification);
      if (next === undefined || next === current) return;
      const changed = current !== undefined;
      current = next;
      if (changed) onDocumentChange();
    });
  }, [tabId]);
}
