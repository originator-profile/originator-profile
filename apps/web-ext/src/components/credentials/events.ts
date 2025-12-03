import { defineExtensionMessaging } from "@webext-core/messaging";
import { FetchCredentialsMessageResponse } from "./types";
import { VerifyIntegrity } from "@originator-profile/verify";

type CredentialsProtocolMap = {
  fetchCredentials(message: null): FetchCredentialsMessageResponse;
  verifyIntegrity(
    message: Parameters<VerifyIntegrity>,
  ): Awaited<ReturnType<VerifyIntegrity>>;
};

export const credentialsMessenger =
  defineExtensionMessaging<CredentialsProtocolMap>();
