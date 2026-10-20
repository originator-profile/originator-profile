import {
  isTopFrameUnreachable,
  type SubscribedTabVerification,
} from "@originator-profile/extension-common";
import { toProblemDetails, type VerifiedSp } from "@originator-profile/verify";
import { useMemo } from "react";
import { useParams } from "react-router";
import { toLegacyWebsite } from "../../utils/to-legacy-result";
import { useSubscribedTabVerification } from "../activeTab/use-tab-verification";

type SiteProfileView =
  | { isLoading: true; siteProfile?: never; error?: never }
  | { isLoading: false; siteProfile?: never; error: Error }
  | {
      isLoading: false;
      siteProfile: VerifiedSp;
      error?: never;
      warnings: string[];
      info: string[];
    };

function toSiteProfileView(
  subscribed: SubscribedTabVerification,
): SiteProfileView {
  if (isTopFrameUnreachable(subscribed)) {
    return {
      isLoading: false,
      error: toLegacyWebsite({
        status: false,
        securingResults: [],
        warnings: [],
        info: [],
        errors: [
          toProblemDetails(new Error("No response from top level frame")),
        ],
      }) as Error,
    };
  }

  const entry = subscribed.verification?.siteProfile;
  if (!entry) return { isLoading: true };

  const legacy = toLegacyWebsite(entry.result);
  if (legacy instanceof Error) return { isLoading: false, error: legacy };
  return {
    isLoading: false,
    siteProfile: legacy,
    warnings: entry.result.warnings.map(({ title }) => title),
    info: entry.result.info.map(({ title }) => title),
  };
}

/**
 * Site Profile 取得 (要 Base コンポーネント)
 */
export function useSiteProfile() {
  const params = useParams<{ tabId: string }>();
  const tabId = Number(params.tabId);
  const subscribed = useSubscribedTabVerification(tabId);
  const view = useMemo(() => toSiteProfileView(subscribed), [subscribed]);
  return {
    error: view.error,
    isLoading: view.isLoading,
    siteProfile: view.siteProfile,
    tabId,
    warnings: "warnings" in view ? view.warnings : undefined,
    info: "info" in view ? view.info : undefined,
  };
}
