import { setupBackground } from "@originator-profile/extension-common/background";
import { verifyTabCredentials } from "./components/tabBadge";

setupBackground({
  buildWarningUrl: (params) =>
    `${chrome.runtime.getURL("index.html")}#/warning?${params.toString()}`,
  countCredentials: async (tabId) =>
    (await verifyTabCredentials(tabId))?.count ?? 0,
  permissionGuideUrl:
    "https://cip.docs.originator-profile.org/web-ext/experimental-use/#setup-in-firefox",
});
