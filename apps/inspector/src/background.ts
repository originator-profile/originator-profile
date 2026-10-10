import { setupBackground } from "@originator-profile/extension-common/background";
import { countCredentials } from "./components/tabBadge";

setupBackground({
  buildWarningUrl: (params) =>
    `${chrome.runtime.getURL("index.html")}#/warning?${params.toString()}`,
  countCredentials,
  permissionGuideUrl:
    "https://cip.docs.originator-profile.org/web-ext/experimental-use/#setup-in-firefox",
});
