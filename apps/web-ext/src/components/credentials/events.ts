import { VerifyIntegrity } from "@originator-profile/verify";
import { defineExtensionMessaging } from "@webext-core/messaging";
import { FetchIntegrityMessageResult } from "../integrity/type";
import { FetchCredentialsMessageResponse } from "./types";

type CredentialsProtocolMap = {
  fetchCredentials(message: null): FetchCredentialsMessageResponse;
  verifyIntegrity(
    message: Parameters<VerifyIntegrity>,
  ): Awaited<FetchIntegrityMessageResult>;
};

export const credentialsMessenger =
  defineExtensionMessaging<CredentialsProtocolMap>();
