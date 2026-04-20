import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  ALL_FRAMES_TIMEOUT_MS,
  createFrameReadinessTracker,
  type FrameReadinessTracker,
} from "./frame-readiness-tracker";

describe("createFrameReadinessTracker", () => {
  let onRefetch: ReturnType<typeof vi.fn<(tabId: number) => void>>;
  let tracker: FrameReadinessTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    onRefetch = vi.fn<(tabId: number) => void>();
    tracker = createFrameReadinessTracker(onRefetch);
  });

  afterEach(() => {
    tracker.dispose();
    vi.useRealTimers();
  });

  describe("表示中タブのフィルタリング", () => {
    test("非表示タブの contentReady は skip を返す", () => {
      const result = tracker.handleContentReady(1, 0, false);
      expect(result).toBe("skip");
    });
  });

  describe("メインフレームの contentReady", () => {
    test("pending を返す", () => {
      const result = tracker.handleContentReady(1, 0, true);
      expect(result).toBe("pending");
    });
  });

  describe("サブフレームなしのページ", () => {
    test("resolveExpectedFrames でフレームが1つ以下なら即 refetch", () => {
      tracker.handleContentReady(1, 0, true);

      const result = tracker.resolveExpectedFrames(1, new Set([0]));
      expect(result).toBe("refetch");
      expect(onRefetch).toHaveBeenCalledWith(1);
    });
  });

  describe("サブフレームありのページ", () => {
    test("全フレーム ready で refetch", () => {
      tracker.handleContentReady(1, 0, true);
      tracker.resolveExpectedFrames(1, new Set([0, 1, 2]));

      tracker.handleContentReady(1, 1, true); // subframe
      expect(onRefetch).not.toHaveBeenCalled();

      const result = tracker.handleContentReady(1, 2, true); // last subframe
      expect(result).toBe("refetch");
      expect(onRefetch).toHaveBeenCalledWith(1);
    });

    test("一部フレームのみ ready では pending のまま", () => {
      tracker.handleContentReady(1, 0, true);
      tracker.resolveExpectedFrames(1, new Set([0, 1, 2]));

      const result = tracker.handleContentReady(1, 1, true);
      expect(result).toBe("pending");
      expect(onRefetch).not.toHaveBeenCalled();
    });
  });

  describe("タイムアウト", () => {
    test("3秒後に onRefetch が呼ばれる", () => {
      tracker.handleContentReady(1, 0, true);
      tracker.resolveExpectedFrames(1, new Set([0, 1]));

      expect(onRefetch).not.toHaveBeenCalled();
      vi.advanceTimersByTime(ALL_FRAMES_TIMEOUT_MS);
      expect(onRefetch).toHaveBeenCalledWith(1);
    });

    test("全フレーム ready 後はタイムアウトで重複呼び出しされない", () => {
      tracker.handleContentReady(1, 0, true);
      tracker.resolveExpectedFrames(1, new Set([0, 1]));

      tracker.handleContentReady(1, 1, true); // refetch
      expect(onRefetch).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(ALL_FRAMES_TIMEOUT_MS);
      expect(onRefetch).toHaveBeenCalledTimes(1); // 増えない
    });
  });

  describe("レースコンディション対応", () => {
    test("resolveExpectedFrames 前にサブフレームが到着しても蓄積される", () => {
      tracker.handleContentReady(1, 0, true); // pending (expected: null)

      // resolveExpectedFrames 前にサブフレームが到着
      tracker.handleContentReady(1, 1, true); // received に蓄積
      tracker.handleContentReady(1, 2, true); // received に蓄積

      // expected を確定 → 既に全フレーム ready
      const result = tracker.resolveExpectedFrames(1, new Set([0, 1, 2]));
      expect(result).toBe("refetch");
      expect(onRefetch).toHaveBeenCalledWith(1);
    });
  });

  describe("連続遷移", () => {
    test("2回目のメインフレーム ready で1回目がキャンセルされる", () => {
      tracker.handleContentReady(1, 0, true); // 1回目 pending
      tracker.resolveExpectedFrames(1, new Set([0, 1]));

      // 2回目のナビゲーション
      tracker.handleContentReady(1, 0, true); // 2回目 pending (1回目キャンセル)
      tracker.resolveExpectedFrames(1, new Set([0])); // サブフレームなし

      expect(onRefetch).toHaveBeenCalledTimes(1);

      // 1回目のタイムアウトが発火しないことを確認
      vi.advanceTimersByTime(ALL_FRAMES_TIMEOUT_MS);
      expect(onRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("フレームフィルタ", () => {
    test("pending が存在しないタブのサブフレーム contentReady は skip", () => {
      const result = tracker.handleContentReady(99, 1, true);
      expect(result).toBe("skip");
    });

    test("pending が存在しないタブの resolveExpectedFrames は skip", () => {
      const result = tracker.resolveExpectedFrames(99, new Set([0]));
      expect(result).toBe("skip");
    });
  });

  describe("removeTab", () => {
    test("閉じたタブの pending タイマーがクリアされる", () => {
      tracker.handleContentReady(1, 0, true); // pending (timer set)

      tracker.removeTab(1);

      vi.advanceTimersByTime(ALL_FRAMES_TIMEOUT_MS);
      expect(onRefetch).not.toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    test("全タイマーがクリアされ onRefetch が呼ばれない", () => {
      tracker.handleContentReady(1, 0, true); // pending (timer set)

      tracker.dispose();

      vi.advanceTimersByTime(ALL_FRAMES_TIMEOUT_MS);
      expect(onRefetch).not.toHaveBeenCalled();
    });
  });
});
