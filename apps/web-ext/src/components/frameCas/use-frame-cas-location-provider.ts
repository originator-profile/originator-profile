import { frameCasExtensionMessenger } from "./extension-events";
import { type FrameVerifiedCas } from "../credentials";
import { useEffect, useCallback } from "react";

export function useFrameCasLocationProvider(
  tabId: number,
  framesCas: FrameVerifiedCas[],
): void {
  const targetFramesCas = framesCas.filter(
    (frameCas) => frameCas.cas.length > 0,
  );
  const handler = useCallback(() => {
    for (const frameCas of targetFramesCas) {
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
  }, [tabId, framesCas, targetFramesCas]);
  useEffect(() => {
    handler();
    const cleanup = frameCasExtensionMessenger.onMessage("reLocate", handler);
    return () => {
      cleanup();
    };
  }, [handler]);
}
