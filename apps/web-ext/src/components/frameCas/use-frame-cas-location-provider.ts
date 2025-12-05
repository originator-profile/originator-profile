import { useEffect } from "react";
import { type FrameVerifiedCas } from "../credentials";
import { frameCasExtensionMessenger } from "./extension-events";

export function useFrameCasLocationProvider(
  tabId: number,
  framesCas: FrameVerifiedCas[],
): void {
  useEffect(() => {
    void frameCasExtensionMessenger.sendMessage(
      "prepareReLocate",
      { tabId, framesCas },
      {
        tabId,
      },
    );
    void frameCasExtensionMessenger.sendMessage("prepareReLocate", {
      tabId,
      framesCas,
    });
  }, [tabId, framesCas]);
}
