import { ContentAttestation } from "@originator-profile/model";
import { describe, expect, test } from "vitest";
import { verifyAllowedOrigin } from "./verify-allowed-origin";

describe("verify-allowed-origin", () => {
  test("allowedOriginの配列に対する検証でtrueが返されるか", () => {
    const contentAttestation: ContentAttestation = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "ContentAttestation"],
      issuer: "dns:example.com",
      credentialSubject: {
        id: "urn:uuid:78550fa7-f846-4e0f-ad5c-8d34461cb95b",
        type: "OnlineAd",
        name: "<広告のタイトル>",
        description: "<広告の説明>",
        image: {
          id: "https://ad.example.com/image.png",
          digestSRI: "sha256-5uQVtkoRdTFbimAz3Wz5GQcuBRLt7tDMD5JRtGFo9/M=",
        },
        landingPageUrl: "https://ad.landingpage.example.com",
        adReportContact: {
          id: "https://ad.example.com/contact",
          name: "広告に対する報告窓口",
        },
        adReviewGuidelines: {
          id: "https://ad.example.com/guidelines",
          name: "広告審査ガイドライン",
        },
        targetingPolicy: {
          id: "https://ad.example.com/targeting",
          name: "ターゲティング広告に関するポリシー",
        },
        adDataHandlingPolicy: {
          id: "https://ad.example.com/datahandling",
          name: "広告配信に関する情報の取り扱いについての説明",
        },
        adDisplayRationale: {
          page: {
            id: "https://ad.example.com/rationale",
            name: "この広告が表示されている理由",
          },
          description: "現在閲覧中のコンテンツと関連性が高いため。",
        },
      },
      allowedOrigin: ["https://ad.example.com", "https://ad.example1.com"],
      target: [
        {
          type: "ExternalResourceTargetIntegrity",
          integrity: "sha256-rLDPDYArkNcCvnq0h4IgR7MVfJIOCCrx4z+w+uywc64=",
        },
      ],
    };

    const origin = "https://ad.example.com";
    expect(
      verifyAllowedOrigin(origin, contentAttestation.allowedOrigin as string[]),
    ).toBeTruthy();
  });

  test("allowedOriginの配列に対する検証でfalseが返されるか", () => {
    const contentAttestation: ContentAttestation = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "ContentAttestation"],
      issuer: "dns:example.com",
      credentialSubject: {
        id: "urn:uuid:78550fa7-f846-4e0f-ad5c-8d34461cb95b",
        type: "OnlineAd",
        name: "<広告のタイトル>",
        description: "<広告の説明>",
        image: {
          id: "https://ad.example.com/image.png",
          digestSRI: "sha256-5uQVtkoRdTFbimAz3Wz5GQcuBRLt7tDMD5JRtGFo9/M=",
        },
        landingPageUrl: "https://ad.landingpage.example.com",
        adReportContact: {
          id: "https://ad.example.com/contact",
          name: "広告に対する報告窓口",
        },
        adReviewGuidelines: {
          id: "https://ad.example.com/guidelines",
          name: "広告審査ガイドライン",
        },
        targetingPolicy: {
          id: "https://ad.example.com/targeting",
          name: "ターゲティング広告に関するポリシー",
        },
        adDataHandlingPolicy: {
          id: "https://ad.example.com/datahandling",
          name: "広告配信に関する情報の取り扱いについての説明",
        },
        adDisplayRationale: {
          page: {
            id: "https://ad.example.com/rationale",
            name: "この広告が表示されている理由",
          },
          description: "現在閲覧中のコンテンツと関連性が高いため。",
        },
      },
      allowedOrigin: "https://ad.example.com",
      target: [
        {
          type: "ExternalResourceTargetIntegrity",
          integrity: "sha256-rLDPDYArkNcCvnq0h4IgR7MVfJIOCCrx4z+w+uywc64=",
        },
      ],
    };

    const origin = "https://ad.example.com";

    expect(
      verifyAllowedOrigin(origin, contentAttestation.allowedOrigin as string),
    ).toBeTruthy();
  });

  test("allowedOriginが単一の文字列の検証でtrueが返されるか", () => {
    const contentAttestation: ContentAttestation = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "ContentAttestation"],
      issuer: "dns:example.com",
      credentialSubject: {
        id: "urn:uuid:78550fa7-f846-4e0f-ad5c-8d34461cb95b",
        type: "OnlineAd",
        name: "<広告のタイトル>",
        description: "<広告の説明>",
        image: {
          id: "https://ad.example.com/image.png",
          digestSRI: "sha256-5uQVtkoRdTFbimAz3Wz5GQcuBRLt7tDMD5JRtGFo9/M=",
        },
        landingPageUrl: "https://ad.landingpage.example.com",
        adReportContact: {
          id: "https://ad.example.com/contact",
          name: "広告に対する報告窓口",
        },
        adReviewGuidelines: {
          id: "https://ad.example.com/guidelines",
          name: "広告審査ガイドライン",
        },
        targetingPolicy: {
          id: "https://ad.example.com/targeting",
          name: "ターゲティング広告に関するポリシー",
        },
        adDataHandlingPolicy: {
          id: "https://ad.example.com/datahandling",
          name: "広告配信に関する情報の取り扱いについての説明",
        },
        adDisplayRationale: {
          page: {
            id: "https://ad.example.com/rationale",
            name: "この広告が表示されている理由",
          },
          description: "現在閲覧中のコンテンツと関連性が高いため。",
        },
      },
      allowedOrigin: ["https://ad.example1.com", "https://ad.example2.com"],
      target: [
        {
          type: "ExternalResourceTargetIntegrity",
          integrity: "sha256-rLDPDYArkNcCvnq0h4IgR7MVfJIOCCrx4z+w+uywc64=",
        },
      ],
    };

    const origin = "https://example.com";

    expect(
      verifyAllowedOrigin(origin, contentAttestation.allowedOrigin as string[]),
    ).toBeFalsy();
  });

  test("allowedOriginが単一の文字列の検証でfalseが返されるか", () => {
    const contentAttestation: ContentAttestation = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "ContentAttestation"],
      issuer: "dns:example.com",
      credentialSubject: {
        id: "urn:uuid:78550fa7-f846-4e0f-ad5c-8d34461cb95b",
        type: "OnlineAd",
        name: "<広告のタイトル>",
        description: "<広告の説明>",
        image: {
          id: "https://ad.example.com/image.png",
          digestSRI: "sha256-5uQVtkoRdTFbimAz3Wz5GQcuBRLt7tDMD5JRtGFo9/M=",
        },
        landingPageUrl: "https://ad.landingpage.example.com",
        adReportContact: {
          id: "https://ad.example.com/contact",
          name: "広告に対する報告窓口",
        },
        adReviewGuidelines: {
          id: "https://ad.example.com/guidelines",
          name: "広告審査ガイドライン",
        },
        targetingPolicy: {
          id: "https://ad.example.com/targeting",
          name: "ターゲティング広告に関するポリシー",
        },
        adDataHandlingPolicy: {
          id: "https://ad.example.com/datahandling",
          name: "広告配信に関する情報の取り扱いについての説明",
        },
        adDisplayRationale: {
          page: {
            id: "https://ad.example.com/rationale",
            name: "この広告が表示されている理由",
          },
          description: "現在閲覧中のコンテンツと関連性が高いため。",
        },
      },
      allowedOrigin: "https://ad.example1.com",
      target: [
        {
          type: "ExternalResourceTargetIntegrity",
          integrity: "sha256-rLDPDYArkNcCvnq0h4IgR7MVfJIOCCrx4z+w+uywc64=",
        },
      ],
    };

    const origin = "https://example.com";

    expect(
      verifyAllowedOrigin(origin, contentAttestation.allowedOrigin as string),
    ).toBeFalsy();
  });

  test("空文字で検証をした時にfalseが返されるか", () => {
    expect(verifyAllowedOrigin("", "https://example.com")).toBeFalsy();
  });

  test("一部一致するURLでfalseが返されるか", () => {
    expect(
      verifyAllowedOrigin("https://example.co", "https://example.com"),
    ).toBeFalsy();
  });

  test('"null"オリジンを与えた時にfalseが返されるか', () => {
    expect(verifyAllowedOrigin("null", "https://example.com")).toBeFalsy();
    expect(verifyAllowedOrigin("https://example.com", "null")).toBeFalsy();
    expect(verifyAllowedOrigin("https://example.com", ["null"])).toBeFalsy();
    expect(verifyAllowedOrigin("null", "null")).toBeFalsy();
  });
});
