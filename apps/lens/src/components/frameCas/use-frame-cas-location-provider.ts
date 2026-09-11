import {
  type FrameVerifiedCas,
  frameCasExtensionMessenger,
} from "@originator-profile/extension-common";
import { useEffect } from "react";

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
