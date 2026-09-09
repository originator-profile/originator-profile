import { defineExtensionMessaging } from "@webext-core/messaging";
import type { LinkVerificationResult } from "./types";

type LinkVerificationProtocolMap = {
  adClicked(message: {
    targetopid: string;
    sourceOrgName?: string;
    expectedOrgName?: string;
    isNewTab?: boolean;
  }): void;
  getVerificationResult(tabId: number): LinkVerificationResult;
};

export const linkVerificationMessenger =
  defineExtensionMessaging<LinkVerificationProtocolMap>();
