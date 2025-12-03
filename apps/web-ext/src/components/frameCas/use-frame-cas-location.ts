import { frameCasExtensionMessenger } from "./extension-events";
import { type FrameVerifiedCas } from "../credentials";
import { useEffect, useCallback } from "react";

export function useFrameCasLocation(
  tabId: number,
  framesCas: FrameVerifiedCas[],
): void {
  const handler = useCallback(() => {
    for (const frameCas of framesCas) {
      void frameCasExtensionMessenger.sendMessage(
        "locate",
        {
          frameCas,
          frames: framesCas.map(({ cas: _, ...frame }) => frame),
        },
        {
          tabId,
          frameId: frameCas.frameId,
        },
      );
    }
  }, [tabId, framesCas]);
  useEffect(() => {
    handler();
    const cleanup = frameCasExtensionMessenger.onMessage("reLocate", handler);
    return () => {
      cleanup();
    };
  }, [handler]);
}
