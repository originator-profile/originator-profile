import { startTransition, useCallback } from "react";
import { useEvent, useMount } from "react-use";
import { frameCasWindowMessenger } from "./window-events";

export function useFrameCasLocationConsumer(): void {
  const handler = useCallback(() => {
    startTransition(() => {
      frameCasWindowMessenger.sendMessage("startLocate", null, window.parent);
    });
  }, []);
  useMount(handler);
  useEvent("resize", handler, window.parent);
  useEvent("scroll", handler, window.parent);
}
