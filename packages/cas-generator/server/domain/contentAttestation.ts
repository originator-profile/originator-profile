import { Lang } from "./originatorProfileSite";

type Image = {
  id: string;
  digestSRI?: string;
};

export type TargetIntegrity = {
  type:
    | "TextTargetIntegrity"
    | "VisibleTextTargetIntegrity"
    | "ExternalResourceTargetIntegrity";
  integrity?: string;
  cssSelector?: string;
  content?: string;
};

export type CredentialSubject = {
  id?: string;
  type: string;
  headline: string;
  image: Image;
  description: string;
  author: string[];
  editor: string[];
  datePublished: string;
  dateModified: string;
  genre: string;
};

/**
 * @see https://reference.originator-profile.org/api/#tag/ca/operation/createOrUpdateCa
 */
export type ContentAttestationModel = {
  "@context": (string | { "@language": string })[];
  type: string[];
  issuer: string;
  credentialSubject: CredentialSubject;
  allowedUrl: string[];
  target: TargetIntegrity[];
};

const defaultTypes = ["VerifiableCredential", "ContentAttestation"];

/**
 * デフォルトのContentAttestationを作成します。
 * 固定値を設定している部分は、デフォルトの値を使用します。
 * @param override - デフォルトのContentAttestationの一部を上書きするオブジェクト
 * @returns デフォルトのContentAttestation
 */
export const createDefaultContentAttestation = (
  override: Pick<
    ContentAttestationModel,
    "credentialSubject" | "allowedUrl" | "target" | "issuer"
  >,
  lang: Lang,
): ContentAttestationModel => {
  const defaultCA: ContentAttestationModel = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      { "@language": lang },
    ],
    type: defaultTypes,
    issuer: override.issuer,
    credentialSubject: override.credentialSubject,
    allowedUrl: override.allowedUrl,
    target: override.target,
  };

  return defaultCA;
};
