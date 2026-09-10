import { defineExtensionMessaging } from "@webext-core/messaging";
import { SerializedSiteProfileResult } from "./types";

type SiteProfileProtocolMap = {
  fetchSiteProfile(message: null): SerializedSiteProfileResult;
};

export const siteProfileMessenger =
  defineExtensionMessaging<SiteProfileProtocolMap>();
