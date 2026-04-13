import { ContentAttestation } from "@originator-profile/model";
import { describe, expect, test } from "vitest";
import { verifyAllowedUrl } from "./verify-allowed-url";

describe("verify-allowed-url", () => {
  test("allowedUrlの配列に対する検証でtrueが返されるか", async () => {
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
        type: "Article",
        headline: "<記事のタイトル>",
        image: {
          id: "https://media.example.com/image.png",
          digestSRI: "sha256-OYP9B9EPFBi1vs0dUqOhSbHmtP+ZSTsUv2/OjSzWK0w=",
        },
        description: "<Webページの説明>",
        author: ["山田花子"],
        editor: ["山田太郎"],
        datePublished: "2023-07-04T19:14:00Z",
        dateModified: "2023-07-04T19:14:00Z",
        genre: "Arts & Entertainment",
      },
      allowedUrl: [
        "https://media.example.com/articles/2024-06-30",
        "https://media.example.com/articles/2024-07-01",
      ],
      target: [
        {
          type: "VisibleTextTargetIntegrity",
          cssSelector: "<CSS セレクター>",
          integrity: "sha256-GYC9PqfIw0qWahU6OlReQfuurCI5VLJplslVdF7M95U=",
        },
        {
          type: "ExternalResourceTargetIntegrity",
          integrity: "sha256-+M3dMZXeSIwAP8BsIAwxn5ofFWUtaoSoDfB+/J8uXMo=",
        },
      ],
    };

    const url = "https://media.example.com/articles/2024-07-01";
    expect(
      await verifyAllowedUrl(url, contentAttestation.allowedUrl as string[]),
    ).toBeTruthy();
  });

  test("allowedUrlの配列に対する検証でfalseが返されるか", async () => {
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
        type: "Article",
        headline: "<記事のタイトル>",
        image: {
          id: "https://media.example.com/image.png",
          digestSRI: "sha256-OYP9B9EPFBi1vs0dUqOhSbHmtP+ZSTsUv2/OjSzWK0w=",
        },
        description: "<Webページの説明>",
        author: ["山田花子"],
        editor: ["山田太郎"],
        datePublished: "2023-07-04T19:14:00Z",
        dateModified: "2023-07-04T19:14:00Z",
        genre: "Arts & Entertainment",
      },
      allowedUrl: [
        "https://media.example.com/articles/2024-06-30",
        "https://media.example.com/articles/2024-07-01",
      ],
      target: [
        {
          type: "VisibleTextTargetIntegrity",
          cssSelector: "<CSS セレクター>",
          integrity: "sha256-GYC9PqfIw0qWahU6OlReQfuurCI5VLJplslVdF7M95U=",
        },
        {
          type: "ExternalResourceTargetIntegrity",
          integrity: "sha256-+M3dMZXeSIwAP8BsIAwxn5ofFWUtaoSoDfB+/J8uXMo=",
        },
      ],
    };

    const url = "https://media.example.com/articles/9999-99-99";
    expect(
      await verifyAllowedUrl(url, contentAttestation.allowedUrl as string[]),
    ).toBeFalsy();
  });

  test("allowedUrlが単一の文字列の検証でtrueが返されるか", async () => {
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
        type: "Article",
        headline: "<記事のタイトル>",
        image: {
          id: "https://media.example.com/image.png",
          digestSRI: "sha256-OYP9B9EPFBi1vs0dUqOhSbHmtP+ZSTsUv2/OjSzWK0w=",
        },
        description: "<Webページの説明>",
        author: ["山田花子"],
        editor: ["山田太郎"],
        datePublished: "2023-07-04T19:14:00Z",
        dateModified: "2023-07-04T19:14:00Z",
        genre: "Arts & Entertainment",
      },
      allowedUrl: "https://media.example.com/articles/2024-06-30",
      target: [
        {
          type: "VisibleTextTargetIntegrity",
          cssSelector: "<CSS セレクター>",
          integrity: "sha256-GYC9PqfIw0qWahU6OlReQfuurCI5VLJplslVdF7M95U=",
        },
        {
          type: "ExternalResourceTargetIntegrity",
          integrity: "sha256-+M3dMZXeSIwAP8BsIAwxn5ofFWUtaoSoDfB+/J8uXMo=",
        },
      ],
    };

    const url = "https://media.example.com/articles/2024-06-30";
    expect(
      await verifyAllowedUrl(url, contentAttestation.allowedUrl as string),
    ).toBeTruthy();
  });

  test("allowedUrlが単一の文字列の検証でfalseが返されるか", async () => {
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
        type: "Article",
        headline: "<記事のタイトル>",
        image: {
          id: "https://media.example.com/image.png",
          digestSRI: "sha256-OYP9B9EPFBi1vs0dUqOhSbHmtP+ZSTsUv2/OjSzWK0w=",
        },
        description: "<Webページの説明>",
        author: ["山田花子"],
        editor: ["山田太郎"],
        datePublished: "2023-07-04T19:14:00Z",
        dateModified: "2023-07-04T19:14:00Z",
        genre: "Arts & Entertainment",
      },
      allowedUrl: "https://media.example.com/articles/2024-06-30",
      target: [
        {
          type: "VisibleTextTargetIntegrity",
          cssSelector: "<CSS セレクター>",
          integrity: "sha256-GYC9PqfIw0qWahU6OlReQfuurCI5VLJplslVdF7M95U=",
        },
        {
          type: "ExternalResourceTargetIntegrity",
          integrity: "sha256-+M3dMZXeSIwAP8BsIAwxn5ofFWUtaoSoDfB+/J8uXMo=",
        },
      ],
    };

    const url = "https://media.example.com/articles/9999-99-99";
    expect(
      await verifyAllowedUrl(url, contentAttestation.allowedUrl as string),
    ).toBeFalsy();
  });

  test("URLが空文字で検証をした時にfalseが返されるか", async () => {
    expect(
      await verifyAllowedUrl(
        "",
        "https://media.example.com/articles/2024-06-29",
      ),
    ).toBeFalsy();
  });

  test("AllowedUrlが空文字で検証をした時にfalseが返されるか", async () => {
    expect(
      await verifyAllowedUrl(
        "https://media.example.com/articles/2024-06-29",
        "",
      ),
    ).toBeFalsy();
  });

  test("一部一致するURLでfalseが返されるか", async () => {
    expect(
      await verifyAllowedUrl(
        "https://example.com/articles/2024-06-29",
        "https://media.example.com/articles/2024-06-29",
      ),
    ).toBeFalsy();
  });

  describe("URL Pattern stringの正規表現が含まれたURLの場合", () => {
    test("AllowedUrlの末尾パスにワイルドカードを指定をしてtrueが返されるか", async () => {
      expect(
        await verifyAllowedUrl(
          "https://media.example.com/articles/2024-06-29",
          "https://media.example.com/articles/*",
        ),
      ).toBeTruthy();
    });
  });

  test("エンコード部分のケースインセンシティブ検証", async () => {
    expect(
      await verifyAllowedUrl(
        "https://example.com/2023/04/06/%e4%b8%8d%e5%85%b7%e5%90%88535/",
        "https://example.com/2023/04/06/%E4%B8%8D%E5%85%B7%E5%90%88535/",
      ),
    ).toBeTruthy();
  });
  test("エンコード部分以外のケースセンシティブ検証", async () => {
    expect(
      await verifyAllowedUrl(
        "https://example.com/maps/",
        "https://example.com/MAPS/",
      ),
    ).toBeFalsy();
  });
  test("*だけの不正なURLパターンでfalseが返されるか", async () => {
    expect(
      await verifyAllowedUrl("https://example.com/maps/", "*"),
    ).toBeFalsy();
  });
});
