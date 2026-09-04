import type { Serialized } from "@originator-profile/core";
import type {
  AdvertisementCA,
  AdvertorialCA,
  ArticleCA,
  ContentAttestationSet,
  OpMeta,
  OriginatorProfileSet,
  WebMediaProfile,
} from "@originator-profile/model";
import type {
  CredentialSource,
  FetchCredentialSetResult,
  SourcedCredential,
} from "@originator-profile/presentation";
import type {
  IntegrityVerifyResult,
  VerifiedCas,
  VerifiedOp,
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

/**
 * OP の取得経路。
 * ページ埋め込み/外部URL(CredentialSource)に加え、
 * ページ由来ではない経路(レジストリ・Site Profile)も表現する。
 */
export type OpOrigin =
  | CredentialSource
  | { kind: "registry" }
  | { kind: "site-profile" };

/** 出所(取得経路)付き検証済み Originator Profile */
export type VerifiedOpWithSource = VerifiedOp & { source: OpOrigin };
export type VerifiedOpsWithSource = VerifiedOpWithSource[];

/**
 * 出所(取得経路)付き検証済み Content Attestation。
 * CAS はページ由来(ページ埋め込み/外部URL)以外の取得経路を持たないため、
 * OPS の {@link OpOrigin} と異なり source は {@link CredentialSource} のみとなる。
 */
export type SupportedVerifiedCaWithSource = SupportedVerifiedCa & {
  source: CredentialSource;
};
export type SupportedVerifiedCasWithSource = SupportedVerifiedCaWithSource[];
export type FrameLocation = { origin: string; url: string };

export type FetchCredentialsMessageResponse = FrameLocation & {
  ops: Serialized<FetchCredentialSetResult<OriginatorProfileSet>>;
  cas: Serialized<FetchCredentialSetResult<ContentAttestationSet>>;
  opMeta?: OpMeta;
};

export type SerializedIntegrityVerifyResult = Serialized<IntegrityVerifyResult>;

export type FrameResponse = {
  frameId: number;
  parentFrameId: number;
};
export type FrameCredentials = FrameResponse &
  FrameLocation & {
    ops: SourcedCredential<OriginatorProfileSet[number]>[];
    cas: SourcedCredential<ContentAttestationSet[number]>[];
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
  FrameLocation & { cas: SupportedVerifiedCasWithSource };
export type FramesVerifiedCas = FrameVerifiedCas[];

export type ArticleLike =
  | ArticleCA["credentialSubject"]
  | AdvertorialCA["credentialSubject"];
