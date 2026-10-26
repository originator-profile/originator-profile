import type {
  AdvertisementCA,
  AdvertorialCA,
  ArticleCA,
} from "@originator-profile/model";
import type { CredentialSource } from "@originator-profile/presentation";
import type { VerifiedCas, VerifiedOp } from "@originator-profile/verify";

/** 表示に対応している CA */
export type SupportedCa = ArticleCA | AdvertisementCA | AdvertorialCA;
export type SupportedVerifiedCas = VerifiedCas<SupportedCa>;
export type SupportedVerifiedCa = SupportedVerifiedCas[number];

/**
 * OP の取得経路。
 * ページ埋め込み/外部URL(CredentialSource)に加え、
 * ページ由来ではない経路(レジストリ・Site Profile)も表現する。
 */
export type OpOrigin =
  | CredentialSource
  | { kind: "registry" }
  | { kind: "site-profile" };

export const registrySource = (): OpOrigin => ({ kind: "registry" });
export const siteProfileSource = (): OpOrigin => ({ kind: "site-profile" });

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

export type FrameResponse = {
  frameId: number;
  parentFrameId: number;
};
/** フレームに読み込まれている文書 */
export type FrameDocument = {
  documentId: string;
  frameType: chrome.extensionTypes.FrameType;
};
/** タブ内のフレームの位置と、そこに読み込まれている文書 */
export type DocumentFrame = FrameResponse & FrameDocument & FrameLocation;

export type FrameVerifiedCas = DocumentFrame & {
  cas: SupportedVerifiedCasWithSource;
};
export type FramesVerifiedCas = FrameVerifiedCas[];

export type ArticleLike =
  | ArticleCA["credentialSubject"]
  | AdvertorialCA["credentialSubject"];
