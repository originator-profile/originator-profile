import { startTransition } from "react";
import { useEvent, useMount, useUnmount } from "react-use";
import { useDebouncedCallback } from "use-debounce";
import { frameCasWindowMessenger } from "./window-events";

type DebounceOptions = {
  debounceMs: number;
};

const DEFAULT_OPTIONS: DebounceOptions = {
  debounceMs: 300,
};

export function useFrameCasLocationConsumer(
  options: Partial<DebounceOptions> = {},
  onLocating?: () => void,
): void {
  const { debounceMs } = { ...DEFAULT_OPTIONS, ...options };

  const sendStartLocate = useDebouncedCallback(() => {
    startTransition(() => {
      frameCasWindowMessenger.sendMessage("startLocate", null, window.parent);
    });
  }, debounceMs);

  const handler = () => {
    onLocating?.();
    sendStartLocate();
  };

  useEvent("resize", handler, window.parent);
  useEvent("scroll", handler, window.parent);

  useMount(() => {
    handler();
  });

  useUnmount(() => {
    sendStartLocate.flush();
  });
}
