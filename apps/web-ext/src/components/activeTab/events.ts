import { defineExtensionMessaging } from "@webext-core/messaging";

type ActiveTabProtocolMap = {
  contentReady(data: null): void;
};

export const activeTabMessenger =
  defineExtensionMessaging<ActiveTabProtocolMap>();
