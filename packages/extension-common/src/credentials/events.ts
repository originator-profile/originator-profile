import type { Target } from "@originator-profile/model";
import { defineExtensionMessaging } from "@webext-core/messaging";
import {
  FetchCredentialsMessageResponse,
  SerializedIntegrityVerifyResult,
} from "./types";

type CredentialsProtocolMap = {
  fetchCredentials(message: null): FetchCredentialsMessageResponse;
  verifyIntegrity(message: Target): SerializedIntegrityVerifyResult;
};

export const credentialsMessenger =
  defineExtensionMessaging<CredentialsProtocolMap>();
