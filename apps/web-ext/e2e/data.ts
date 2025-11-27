import type {
  Certificate,
  CoreProfile,
  Jwk,
  UnsignedContentAttestation,
  WebMediaProfile,
  WebsiteProfile,
} from "@originator-profile/model";

export function generateCoreProfileData(
  publicKey: Jwk,
  issuer: string = "dns:localhost",
): CoreProfile {
  return {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
    ],
    type: ["VerifiableCredential", "CoreProfile"],
    issuer: issuer,
    credentialSubject: {
      id: issuer,
      type: "Core",
      jwks: {
        keys: [publicKey],
      },
    },
  };
}

export function generateCertificateData(
  issuer: string = "dns:localhost",
): Certificate {
  return {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      {
        "@language": "ja",
      },
    ],
    type: ["VerifiableCredential", "Certificate"],
    issuer: issuer,
    credentialSubject: {
      id: issuer,
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
}

export function generateWebMediaProfileData(
  issuer: string = "dns:localhost",
): WebMediaProfile {
  return {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      {
        "@language": "ja",
      },
    ],
    type: ["VerifiableCredential", "WebMediaProfile"],
    issuer: issuer,
    credentialSubject: {
      id: issuer,
      type: "OnlineBusiness",
      name: "Originator Profile 技術研究組合 (開発用)",
      url: "http://localhost:8080",
    },
  };
}

export function generateWebsiteProfileData(
  issuer: string = "dns:op-holder.example.com",
): WebsiteProfile {
  return {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      {
        "@language": "ja",
      },
    ],
    type: ["VerifiableCredential", "WebsiteProfile"],
    issuer: issuer,
    credentialSubject: {
      id: "http://localhost:8080",
      type: "WebSite",
      name: "SiteProfileの取得検証",
      description: "<Webサイトの説明>",
      image: {
        id: "https://media.example.com/image.png",
      },
      allowedOrigin: ["http://localhost:8080"],
    },
  };
}

export function generateUnsignedContentAttestation(
  content: string,
  issuer: string = "dns:op-holder.example.com",
  attestationType: "Article" | "Advertorial" | "OnlineAd" = "Article",
): UnsignedContentAttestation {
  const baseAttestation = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      {
        "@language": "ja",
      },
    ],
    type: ["VerifiableCredential", "ContentAttestation"],
    issuer: issuer,
    allowedUrl: "http://localhost:8080/*",
    target: [
      {
        type: "TextTargetIntegrity" as const,
        content,
        cssSelector: "#text-target-integrity",
      },
    ],
  };

  if (attestationType === "Article") {
    return {
      ...baseAttestation,
      credentialSubject: {
        type: "Article",
        headline: "<Webページのタイトル>",
        image: {
          id: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
        },
        description: "<Webページの説明>",
        author: ["山田花子"],
        editor: ["山田太郎"],
        datePublished: "2023-07-04T19:14:00Z",
        dateModified: "2023-07-04T19:14:00Z",
        genre: "Arts & Entertainment",
        id: "urn:uuid:5c464165-c579-4fc9-aaff-ca4a65e79947",
      },
    };
  }

  if (attestationType === "Advertorial") {
    return {
      ...baseAttestation,
      credentialSubject: {
        type: "Advertorial",
        headline: "<記事広告のタイトル>",
        image: {
          id: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
        },
        description: "<記事広告の説明>",
        author: ["山田花子"],
        editor: ["山田太郎"],
        sponsor: ["スポンサー"],
        datePublished: "2023-07-04T19:14:00Z",
        dateModified: "2023-07-04T19:14:00Z",
        genre: "Arts & Entertainment",
        id: "urn:uuid:5c464165-c579-4fc9-aaff-ca4a65e79947",
      },
    };
  }

  return {
    ...baseAttestation,
    credentialSubject: {
      type: "OnlineAd",
      name: "テスト広告タイトル",
      image: {
        id: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
      },
      description: "テスト広告の説明文",
      genre: "Arts & Entertainment",
      landingPageUrl: "https://ad.landingpage.example.com",
      id: "urn:uuid:5c464165-c579-4fc9-aaff-ca4a65e79947",
    },
  };
}
