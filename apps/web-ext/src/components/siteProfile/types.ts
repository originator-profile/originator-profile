import { WebMediaProfile, WebsiteProfile } from "@originator-profile/model";
import { FetchSiteProfileSuccess } from "@originator-profile/presentation";
import { VerifiedSp } from "@originator-profile/verify";

export type SiteProfileProps = {
  orgPath?: { pathname: string; search: string };
  siteProfile: VerifiedSp;
  wmp?: WebMediaProfile;
  wsp: WebsiteProfile;
};

export type SerializedFetchSiteProfileFailed = string;
export type FetchSiteProfileMessageResult =
  | FetchSiteProfileSuccess
  | SerializedFetchSiteProfileFailed;
