import { WebsiteProfile } from "@originator-profile/model";
import {
  JwtVcDecodingResult,
  JwtVcVerificationResult,
  VerifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import { CoreProfileNotFound } from "../originator-profile-set/errors";
import {
  OpsVerificationResult,
  VerifiedOps,
} from "../originator-profile-set/types";
import { SiteProfileInvalid, SiteProfileVerifyFailed } from "./verify-errors";

/** Site Profile 検証失敗 */
export type SpVerificationFailure = {
  originators: OpsVerificationResult;
  sites: (
    | JwtVcVerificationResult<WebsiteProfile>
    | JwtVcDecodingResult<WebsiteProfile>
    | CoreProfileNotFound<WebsiteProfile>
  )[];
};

export type VerifiedSp = {
  originators: VerifiedOps;
  sites: VerifiedJwtVc<WebsiteProfile>[];
};

export type SpVerificationResult =
  | VerifiedSp
  | SiteProfileInvalid
  | SiteProfileVerifyFailed;
