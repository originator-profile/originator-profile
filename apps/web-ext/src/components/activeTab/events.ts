import { defineExtensionMessaging } from "@webext-core/messaging";

type ActiveTabProtocolMap = {
  contentReady(data: null): void;
  firefoxSidebarOpened(data: { windowId: number }): void;
};

export const activeTabMessenger =
  defineExtensionMessaging<ActiveTabProtocolMap>();
