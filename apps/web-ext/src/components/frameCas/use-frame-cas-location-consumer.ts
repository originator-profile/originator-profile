import { startTransition, useCallback, useRef, useEffect } from "react";
import { useEvent, useMount } from "react-use";
import { frameCasWindowMessenger } from "./window-events";

type DebounceOptions = {
  debounceMs: number;
};

const DEFAULT_OPTIONS: DebounceOptions = {
  debounceMs: 300,
};

export function useFrameCasLocationConsumer(
  options: Partial<DebounceOptions> = {},
  onLocatingChange?: (isLocating: boolean) => void,
): void {
  const { debounceMs } = { ...DEFAULT_OPTIONS, ...options };
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const sendStartLocate = useCallback(() => {
    startTransition(() => {
      frameCasWindowMessenger.sendMessage("startLocate", null, window.parent);
    });
  }, []);

  const handler = useCallback(() => {
    // デバウンスタイマーをクリア
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // ローディング開始を通知
    onLocatingChange?.(true);

    // デバウンス: イベント停止後に更新
    debounceTimerRef.current = setTimeout(() => {
      sendStartLocate();
      debounceTimerRef.current = null;
    }, debounceMs);
  }, [debounceMs, sendStartLocate, onLocatingChange]);

  useMount(() => {
    // マウント時は即座に実行
    onLocatingChange?.(true);
    sendStartLocate();
  });

  useEvent("resize", handler, window.parent);
  useEvent("scroll", handler, window.parent);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
}
