import { startTransition, useCallback } from "react";
import { useEvent } from "react-use";
import { frameCasWindowMessenger } from "./window-events";

export function useFrameCasLocationConsumer(): void {
  const handler = useCallback(() => {
    startTransition(() => {
      frameCasWindowMessenger.sendMessage("reLocate", null, window.parent);
    });
  }, []);
  useEvent("resize", handler, window.parent);
  useEvent("scroll", handler, window.parent);
}
