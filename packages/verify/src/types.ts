import { Dp, JwtDpPayload, JwtOpPayload, Op } from "@originator-profile/model";
import { JWTVerifyResult, ResolvedKey } from "jose";
import {
  ProfileClaimsValidationFailed,
  ProfileTokenVerifyFailed,
  ProfilesResolveFailed,
  ProfilesVerifyFailed,
} from "./errors";

export interface ProfilePair {
  op: {
    iss: string;
    sub: string;
    profile: string;
  };
  dp: {
    sub: string;
    profile: string;
  };
}

export interface WebsiteProfilePair {
  "@context": string;
  website: ProfilePair;
}

export interface AdProfilePair {
  "@context": string;
  ad: ProfilePair;
}

/** Profile の Token の復号結果 */
export type DecodeResult =
  | { op: true; payload: JwtOpPayload; jwt: string }
  | { dp: true; payload: JwtDpPayload; jwt: string }
  | ProfileClaimsValidationFailed;

/** Profile の Token の検証結果 */
export type VerifyTokenResult =
  | (JWTVerifyResult &
      ResolvedKey &
      ({ op: Op; jwt: string } | { dp: Dp; jwt: string }))
  | ProfileClaimsValidationFailed
  | ProfileTokenVerifyFailed;

/** Profile Set */
export type Profiles = { profile: string[]; ad?: ProfilePair[] };

/** Profile の検証結果 */
export type VerifyResult =
  | VerifyTokenResult
  | ProfilesResolveFailed
  | ProfilesVerifyFailed;

/** Profile Set の検証結果 */
export type VerifyResults = VerifyResult[];
