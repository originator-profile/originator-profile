import {
  ArticleCA,
  Certificate,
  CoreProfile,
  Jwk,
  OpVc,
  WebMediaProfile,
  WebsiteProfile,
} from "@originator-profile/model";
import {
  UnverifiedJwtVc,
  VerifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import { diffApply } from "just-diff-apply";

/**
 * JSON Patch を適用する関数
 *
 * @link https://jsonpatch.com/
 */
export const patch = <T extends object>(
  ...args: Parameters<typeof diffApply<T>>
) => {
  const [source, diff] = args;
  const patched = structuredClone(source);
  diffApply(patched, diff);
  return patched;
};

/**
 * VerifyResult ファクトリー
 *
 * @link UnverifiedJwtVc
 * @link VerifiedJwtVc
 */
export const VerifyResultFactory = (issuedAt: Date, expiredAt: Date) => ({
  create: (
    /** VC 文書 */
    vc: OpVc,
    /** JWT */
    jwt: string,
    /** 検証鍵 */
    verificationKey?: Jwk,
    /** バリデーターによる検証の有無 */
    validated: boolean = false,
  ): UnverifiedJwtVc<OpVc> | VerifiedJwtVc<OpVc> => {
    const unverified = {
      doc: vc,
      issuedAt,
      expiredAt,
      algorithm: "ES256",
      mediaType: "application/vc+jwt",
      source: jwt,
    };
    if (!verificationKey) return unverified;
    return { ...unverified, verificationKey, validated };
  },
});

/** OP ID Constants */
export const opId = {
  /** CP 発行者 */
  authority: "dns:cp-issuer.example.org" as const,
  /** PA 発行者 */
  certifier: "dns:pa-issuer.example.org" as const,
  /** CA 発行者 */
  originator: "dns:originator.example.org" as const,
  /** 無効な第三者 */
  invalid: "dns:invalid.example.org" as const,
};

/** Core Profile */
export const cp: CoreProfile = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
  ],
  type: ["VerifiableCredential", "CoreProfile"],
  issuer: opId.authority,
  credentialSubject: {
    id: opId.originator,
    type: "Core",
    jwks: {
      keys: [],
    },
  },
};
/** Certificate  */
export const certificate: Certificate = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
      "@language": "ja",
    },
  ],
  type: ["VerifiableCredential", "Certificate"],
  issuer: opId.certifier,
  credentialSubject: {
    id: opId.originator,
    type: "CertificateProperties",
    description: "Example Certificate",
    certificationSystem: {
      id: "urn:uuid:de5d6e80-10a5-404f-b4d3-e9f0e6926a21",
      type: "CertificationSystem",
      name: "Example Certification System",
      description: "Example Certification System Description",
    },
  },
};
/** Web Media Profile */
export const wmp: WebMediaProfile = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
      "@language": "ja",
    },
  ],
  type: ["VerifiableCredential", "WebMediaProfile"],
  issuer: opId.authority,
  credentialSubject: {
    id: opId.originator,
    type: "OnlineBusiness",
    name: "Example OP Holder",
    url: "https://op-originator.example.org/",
  },
};
/** Website Profile */
export const wsp: WebsiteProfile = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
      "@language": "ja",
    },
  ],
  type: ["VerifiableCredential", "WebsiteProfile"],
  issuer: opId.originator,
  credentialSubject: {
    id: "https://originator.example.org",
    type: "WebSite",
    name: "Example Website",
    description: "Example Website Description",
    allowedOrigin: ["https://originator.example.org"],
  },
};
/** CA ID */
export const caId = "urn:uuid:78550fa7-f846-4e0f-ad5c-8d34461cb95b";
/** CA URL */
export const caUrl = new URL("https://www.example.org/articles/example");
/** Article CA */
export const article: ArticleCA = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    { "@language": "ja" },
  ],
  type: ["VerifiableCredential", "ContentAttestation"],
  issuer: opId.originator,
  target: [],
  allowedUrl: ["https://www.example.org/articles*"],
  credentialSubject: {
    id: caId,
    type: "Article",
    headline: "テスト記事",
    description: "記事の説明",
  },
};
