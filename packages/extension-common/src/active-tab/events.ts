import { defineExtensionMessaging } from "@webext-core/messaging";

type ActiveTabProtocolMap = {
  firefoxSidebarOpened(data: { windowId: number }): void;
};

export const activeTabMessenger =
  defineExtensionMessaging<ActiveTabProtocolMap>();
