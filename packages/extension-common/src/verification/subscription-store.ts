import {
  requestTabVerification,
  topFrameOf,
  watchTabVerification,
} from "./tab-verification";
import type { TabVerification } from "./types";

/**
 * 購読ストアが提供するタブの検証の状態
 *
 * 検証結果ストアから読み出した状態に、検証を求めたときの到達確認の結果を加える。
 */
export type SubscribedTabVerification = {
  verification?: TabVerification;
  /** 検証を求めた時点で content script に到達できた文書。問い合わせ中は undefined */
  reachable?: string[];
  /** 検証を求めた時点でタブが読み込み中だったか */
  loading?: boolean;
  /** 状態を読み出せなかった */
  error?: Error;
};

/**
 * タブの検証の状態の購読ストア
 *
 * 検証結果ストアの変化を購読し、`useSyncExternalStore` に渡せる形で提供する。
 * 結果は保持せず、変化のたびに検証結果ストアから読み直す。
 */
export type TabVerificationStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => SubscribedTabVerification;
};

const topDocumentIdOf = (verification?: TabVerification) =>
  topFrameOf(verification)?.frame.documentId;

function createStore(tabId: number): TabVerificationStore {
  let snapshot: SubscribedTabVerification = {};
  let dispose: (() => void) | undefined;
  const listeners = new Set<() => void>();

  const update = (patch: SubscribedTabVerification) => {
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
      const top = topFrameOf(snapshot.verification);
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

const stores = new Map<number, TabVerificationStore>();
let tracksRemovedTabs = false;

/**
 * タブの検証の状態の購読ストアを得る。同じタブには同じストアを返す
 * @param tabId タブID
 */
export function tabVerificationStoreOf(tabId: number): TabVerificationStore {
  // NOTE: このモジュールは content script にも読み込まれる。content script では
  // chrome.tabs を使えないため、ストアを求められるまで登録しない
  if (!tracksRemovedTabs) {
    chrome.tabs.onRemoved.addListener((removed) => stores.delete(removed));
    tracksRemovedTabs = true;
  }
  const store = stores.get(tabId) ?? createStore(tabId);
  stores.set(tabId, store);
  return store;
}

/**
 * トップレベル文書に到達できないか
 *
 * 検証結果を持つ文書には到達できている。読み込み中のタブでは content script が
 * まだ応答できないことがあるため、到達できないとは決めない。
 */
export function isTopFrameUnreachable(subscribed: SubscribedTabVerification) {
  if (subscribed.error) return true;
  if (!subscribed.verification) return false;
  const top = topFrameOf(subscribed.verification);
  if (!top) return true;
  if (top.entry || subscribed.reachable === undefined || subscribed.loading) {
    return false;
  }
  return !subscribed.reachable.includes(top.frame.documentId);
}
