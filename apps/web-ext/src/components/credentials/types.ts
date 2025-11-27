import {
  AdvertisementCA,
  ArticleCA,
  AdvertorialCA,
  ContentAttestationSet,
  OriginatorProfileSet,
  WebMediaProfile,
} from "@originator-profile/model";
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
};
export type FrameLocation = { origin: string; url: string };
export type FetchCredentialsMessageResult<T, E> = T | E;

export type VerifyFailed = string;

export type FetchCredentialsMessageResponse = FrameLocation & {
  ops: FetchCredentialsMessageResult<OriginatorProfileSet, VerifyFailed>;
  cas: FetchCredentialsMessageResult<ContentAttestationSet, VerifyFailed>;
};

export type FrameResponse<T = unknown> = T & {
  frameId: number;
  parentFrameId: number;
};
export type FrameCredentials = FrameResponse<
  {
    ops: OriginatorProfileSet;
    cas: ContentAttestationSet;
  } & FrameLocation
>;
export type TabCredentials = FrameCredentials & { frames: FrameCredentials[] };

export type ArticleLike =
  | ArticleCA["credentialSubject"]
  | AdvertorialCA["credentialSubject"];
