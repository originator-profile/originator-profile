import type { Serialized } from "@originator-profile/core";
import type {
  AdvertisementCA,
  AdvertorialCA,
  ArticleCA,
  ContentAttestationSet,
  OriginatorProfileSet,
  WebMediaProfile,
} from "@originator-profile/model";
import type {
  IntegrityVerifyResult,
  VerifiedCas,
  VerifiedOps,
} from "@originator-profile/verify";

/** 表示に対応している CA */
export type SupportedCa = ArticleCA | AdvertisementCA | AdvertorialCA;
export type SupportedVerifiedCas = VerifiedCas<SupportedCa>;
export type SupportedVerifiedCa = SupportedVerifiedCas[number];
export type CredentialsProps = {
  ca: SupportedVerifiedCa;
  cas: SupportedVerifiedCas;
  ops: VerifiedOps;
  orgPath?: { pathname: string; search: string };
  wmp?: WebMediaProfile;
  framesCas: FramesVerifiedCas;
};
export type FrameLocation = { origin: string; url: string };

export type FetchCredentialsMessageResponse = FrameLocation & {
  ops: Serialized<OriginatorProfileSet>;
  cas: Serialized<ContentAttestationSet>;
};

export type SerializedIntegrityVerifyResult = Serialized<IntegrityVerifyResult>;

export type FrameResponse = {
  frameId: number;
  parentFrameId: number;
};
export type FrameCredentials = FrameResponse &
  FrameLocation & {
    ops: OriginatorProfileSet;
    cas: ContentAttestationSet;
  };
export type TabCredentials = FrameCredentials & { frames: FrameCredentials[] };

export type FrameVerifiedCas = FrameResponse &
  FrameLocation & { cas: SupportedVerifiedCas };
export type FramesVerifiedCas = FrameVerifiedCas[];

export type ArticleLike =
  | ArticleCA["credentialSubject"]
  | AdvertorialCA["credentialSubject"];
