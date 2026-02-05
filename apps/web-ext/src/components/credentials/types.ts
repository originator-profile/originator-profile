import {
  AdvertisementCA,
  AdvertorialCA,
  ArticleCA,
  ContentAttestationSet,
  OpMeta,
  OriginatorProfileSet,
  SiteProfile,
  WebMediaProfile,
} from "@originator-profile/model";
export { type FetchSiteProfileMessageResult } from "../siteProfile/types";
import { FetchSiteProfileMessageResult } from "../siteProfile/types";
import { VerifiedCas, VerifiedOps } from "@originator-profile/verify";

/** 表示に対応している CA */
export type SupportedCa = ArticleCA | AdvertisementCA | AdvertorialCA;
export type SupportedVerifiedCas = VerifiedCas<SupportedCa>;
export type SupportedVerifiedCa = SupportedVerifiedCas[number];
export type CredentialsProps = {
  ca: SupportedVerifiedCa;
  cas: SupportedVerifiedCas;
  ops: VerifiedOps;
  orgPath: { pathname: string; search: string };
  wmp: WebMediaProfile;
  framesCas: FramesVerifiedCas;
};
export type FrameLocation = { origin: string; url: string };
export type FetchCredentialsMessageResult<T, E> = T | E;

export type VerifyFailed = string;

export type FetchCredentialsMessageResponse = FrameLocation & {
  ops: FetchCredentialsMessageResult<OriginatorProfileSet, VerifyFailed>;
  cas: FetchCredentialsMessageResult<ContentAttestationSet, VerifyFailed>;
  sp: FetchSiteProfileMessageResult;
  opMeta?: OpMeta;
};

export type FrameResponse = {
  frameId: number;
  parentFrameId: number;
};
export type FrameCredentials = FrameResponse &
  FrameLocation & {
    ops: OriginatorProfileSet;
    cas: ContentAttestationSet;
    sp: SiteProfile | null;
    opMeta?: OpMeta;
  };
export type TabCredentials = FrameCredentials & { frames: FrameCredentials[] };

export type LinkVerificationResult = {
  status: "matched" | "mismatched" | "missing_opid" | "error" | "none";
  expectedOpId?: string;
  expectedOrgName?: string;
  sourceOrgName?: string;
  destinationOrgName?: string;
  reason?: string;
};

export type FrameVerifiedCas = FrameResponse &
  FrameLocation & { cas: SupportedVerifiedCas };
export type FramesVerifiedCas = FrameVerifiedCas[];

export type ArticleLike =
  | ArticleCA["credentialSubject"]
  | AdvertorialCA["credentialSubject"];
