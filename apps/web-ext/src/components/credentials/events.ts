import { VerifyIntegrity } from "@originator-profile/verify";
import { defineExtensionMessaging } from "@webext-core/messaging";
import { FetchCredentialsMessageResponse } from "./types";

type CredentialsProtocolMap = {
  fetchCredentials(message: null): FetchCredentialsMessageResponse;
  verifyIntegrity(
    message: Parameters<VerifyIntegrity>,
  ): Awaited<ReturnType<VerifyIntegrity>>;
};

export const credentialsMessenger =
  defineExtensionMessaging<CredentialsProtocolMap>();
