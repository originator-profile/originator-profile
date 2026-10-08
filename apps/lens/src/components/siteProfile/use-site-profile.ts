import { VerificationInvalidated } from "@originator-profile/extension-common";
import { toProblemDetails, type VerifiedSp } from "@originator-profile/verify";
import { useMemo } from "react";
import { useParams } from "react-router";
import { toLegacyWebsite } from "../../utils/to-legacy-result";
import {
  isTopFrameUnreachable,
  useTabVerification,
  type TabVerificationSnapshot,
} from "../activeTab/use-tab-verification";

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

function toSiteProfileView(snapshot: TabVerificationSnapshot): SiteProfileView {
  if (isTopFrameUnreachable(snapshot)) {
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

  const entry = snapshot.verification?.siteProfile;
  if (!entry || entry.state === "verifying") return { isLoading: true };
  if (entry.state === "invalidated") {
    return {
      isLoading: false,
      error: new VerificationInvalidated(entry.reason.title, entry.reason),
    };
  }

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
  const snapshot = useTabVerification(tabId);
  const view = useMemo(() => toSiteProfileView(snapshot), [snapshot]);
  return {
    error: view.error,
    isLoading: view.isLoading,
    siteProfile: view.siteProfile,
    tabId,
    warnings: "warnings" in view ? view.warnings : undefined,
    info: "info" in view ? view.info : undefined,
  };
}
