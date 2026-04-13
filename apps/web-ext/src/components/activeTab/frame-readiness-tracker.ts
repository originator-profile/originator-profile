/** タイムアウト（ミリ秒）: 全サブフレームの readiness を待つ上限 */
export const ALL_FRAMES_TIMEOUT_MS = 3_000;

export type ReadinessResult = "skip" | "refetch" | "pending";

type PendingFrames = {
  /** 期待フレーム一覧。null は getAllFrames 完了前（未確定）を示す */
  expected: Set<number> | null;
  received: Set<number>;
  timer: ReturnType<typeof setTimeout>;
};

export type FrameReadinessTracker = {
  handleContentReady: (
    tabId: number,
    frameId: number,
    isCurrentTab: boolean,
  ) => ReadinessResult;
  resolveExpectedFrames: (
    tabId: number,
    frameIds: Set<number>,
  ) => ReadinessResult;
  /** タブが閉じられたときに状態をクリーンアップする */
  removeTab: (tabId: number) => void;
  dispose: () => void;
};

/**
 * フレーム readiness 追跡ロジックを生成する。
 * Content Script の contentReady 通知を集約し、全フレームが通信可能になった
 * タイミングで onRefetch コールバックを呼ぶ。
 */
export function createFrameReadinessTracker(
  onRefetch: (tabId: number) => void,
): FrameReadinessTracker {
  const pendings = new Map<number, PendingFrames>();

  const clearPending = (tabId: number): void => {
    const pending = pendings.get(tabId);
    if (pending) {
      clearTimeout(pending.timer);
      pendings.delete(tabId);
    }
  };

  const triggerRefetch = (tabId: number): void => {
    clearPending(tabId);
    onRefetch(tabId);
  };

  const checkAllReady = (pending: PendingFrames): boolean => {
    if (pending.expected === null) return false;
    for (const id of pending.expected) {
      if (!pending.received.has(id)) return false;
    }
    return true;
  };

  const handleContentReady = (
    tabId: number,
    frameId: number,
    isCurrentTab: boolean,
  ): ReadinessResult => {
    if (!isCurrentTab) return "skip";

    if (frameId === 0) {
      clearPending(tabId);
      const pending: PendingFrames = {
        expected: null,
        received: new Set([0]),
        timer: setTimeout(() => triggerRefetch(tabId), ALL_FRAMES_TIMEOUT_MS),
      };
      pendings.set(tabId, pending);
      return "pending";
    }

    const pending = pendings.get(tabId);
    if (!pending) return "skip";
    pending.received.add(frameId);

    if (checkAllReady(pending)) {
      triggerRefetch(tabId);
      return "refetch";
    }
    return "pending";
  };

  const resolveExpectedFrames = (
    tabId: number,
    frameIds: Set<number>,
  ): ReadinessResult => {
    const pending = pendings.get(tabId);
    if (!pending) return "skip";

    if (frameIds.size <= 1) {
      triggerRefetch(tabId);
      return "refetch";
    }

    pending.expected = frameIds;

    if (checkAllReady(pending)) {
      triggerRefetch(tabId);
      return "refetch";
    }
    return "pending";
  };

  const removeTab = (tabId: number): void => {
    clearPending(tabId);
  };

  const dispose = (): void => {
    for (const pending of pendings.values()) {
      clearTimeout(pending.timer);
    }
    pendings.clear();
  };

  return { handleContentReady, resolveExpectedFrames, removeTab, dispose };
}
