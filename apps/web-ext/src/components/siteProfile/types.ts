import { type Serialized } from "@originator-profile/core";
import { WebMediaProfile, WebsiteProfile } from "@originator-profile/model";
import { FetchSiteProfileResult } from "@originator-profile/presentation";
import { VerifiedSp } from "@originator-profile/verify";

export type SiteProfileProps = {
  orgPath?: { pathname: string; search: string };
  siteProfile: VerifiedSp;
  wmp?: WebMediaProfile;
  wsp: WebsiteProfile;
};

export type SerializedSiteProfileResult = Serialized<FetchSiteProfileResult>;
