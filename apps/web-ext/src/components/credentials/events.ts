import { VerifyIntegrity } from "@originator-profile/verify";
import { defineExtensionMessaging } from "@webext-core/messaging";
import { FetchIntegrityMessageResult } from "../integrity/type";
import {
  FetchCredentialsMessageResponse,
  LinkVerificationResult,
} from "./types";

type CredentialsProtocolMap = {
  fetchCredentials(message: null): FetchCredentialsMessageResponse;
  verifyIntegrity(
    message: Parameters<VerifyIntegrity>,
  ): Awaited<FetchIntegrityMessageResult>;
  adClicked(message: {
    targetopid: string;
    sourceOrgName?: string;
    expectedOrgName?: string;
  }): void;
  getVerificationResult(tabId: number): LinkVerificationResult;
};

export const credentialsMessenger =
  defineExtensionMessaging<CredentialsProtocolMap>();
