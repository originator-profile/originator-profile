import type { Target } from "@originator-profile/model";
import { defineExtensionMessaging } from "@webext-core/messaging";
import {
  FetchCredentialsMessageResponse,
  LinkVerificationResult,
  SerializedIntegrityVerifyResult,
} from "./types";

type CredentialsProtocolMap = {
  fetchCredentials(message: null): FetchCredentialsMessageResponse;
  verifyIntegrity(message: Target): SerializedIntegrityVerifyResult;
  adClicked(message: {
    targetopid: string;
    sourceOrgName?: string;
    expectedOrgName?: string;
    isNewTab?: boolean;
  }): void;
  getVerificationResult(tabId: number): LinkVerificationResult;
};

export const credentialsMessenger =
  defineExtensionMessaging<CredentialsProtocolMap>();
