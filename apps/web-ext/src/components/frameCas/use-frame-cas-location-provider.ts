import { useEffect } from "react";
import { type FrameVerifiedCas } from "../credentials";
import { frameCasExtensionMessenger } from "./extension-events";

export function useFrameCasLocationProvider(
  tabId: number,
  framesCas: FrameVerifiedCas[],
): void {
  useEffect(() => {
    void frameCasExtensionMessenger.sendMessage(
      "prepareLocate",
      { tabId, framesCas },
      {
        tabId,
      },
    );
  }, [tabId, framesCas]);
}
