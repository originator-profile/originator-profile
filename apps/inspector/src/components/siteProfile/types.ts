import { WebMediaProfile, WebsiteProfile } from "@originator-profile/model";
import { VerifiedSp } from "@originator-profile/verify";

export type SiteProfileProps = {
  orgPath?: { pathname: string; search: string };
  siteProfile: VerifiedSp;
  wmp?: WebMediaProfile;
  wsp: WebsiteProfile;
};
