import { generateKey } from "@originator-profile/cryptography";
import {
  AdvertisementCA,
  AdvertorialCA,
  ArticleCA,
  WebMediaProfile,
  WebsiteProfile,
} from "@originator-profile/model";
import { addYears, getUnixTime } from "date-fns";
import { decodeJwt, decodeProtectedHeader } from "jose";
import { describe, expect, test } from "vitest";
import { signJwtVc } from "./sign-vc";

test("signJwtVc() returns valid Website Profile", async () => {
  const issuedAt = new Date();
  const expiredAt = addYears(new Date(), 10);
  const wsp: WebsiteProfile = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      { "@language": "ja" },
    ],
    type: ["VerifiableCredential", "WebsiteProfile"],
    issuer: "dns:example.com",
    credentialSubject: {
      id: "https://media.example.com/",
      type: "WebSite",
      name: "<Webサイトのタイトル>",
      description: "<Webサイトの説明>",
      image: {
        id: "https://media.example.com/image.png",
        digestSRI: "sha256-Upwn7gYMuRmJlD1ZivHk876vXHzokXrwXj50VgfnMnY=",
      },
      allowedOrigin: ["https://media.example.com"],
    },
  };
  const { publicKey, privateKey } = await generateKey();
  const jwt = await signJwtVc(wsp, privateKey, { issuedAt, expiredAt });
  expect(decodeProtectedHeader(jwt).kid).toBe(publicKey.kid);
  const valid = decodeJwt(jwt);
  expect(valid).toStrictEqual({
    iss: wsp.issuer,
    iat: getUnixTime(issuedAt),
    exp: getUnixTime(expiredAt),
    sub: wsp.credentialSubject.id,
    ...wsp,
  });
});

describe("WMP", () => {
  test("WMP", async () => {
    const issuedAt = new Date();
    const expiredAt = addYears(new Date(), 10);
    const wmp: WebMediaProfile = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "WebMediaProfile"],
      issuer: "dns:wmp-issuer.example.org",
      credentialSubject: {
        id: "dns:wmp-holder.example.jp",
        type: "OnlineBusiness",
        url: "https://www.wmp-holder.example.jp/",
        name: "○○メディア (※開発用サンプル)",
        logo: {
          id: "https://www.wmp-holder.example.jp/logo.svg",
          digestSRI: "sha256-...",
        },
        email: "contact@wmp-holder.example.jp",
        telephone: "0000000000",
        contactPoint: {
          id: "https://wmp-holder.example.jp/contact",
          name: "お問い合わせ",
        },
        privacyPolicy: {
          id: "https://wmp-holder.example.jp/privacy",
          name: "プライバシーポリシー",
        },
        informationTransmissionPolicy: {
          id: "https://wmp-holder.example.jp/statement",
          name: "新聞倫理綱領",
        },
        description: "この文章はこの Web メディアに関する補足情報です。",
      },
    };
    const { publicKey, privateKey } = await generateKey();
    const jwt = await signJwtVc(wmp, privateKey, { issuedAt, expiredAt });
    expect(decodeProtectedHeader(jwt).kid).toBe(publicKey.kid);
    const valid = decodeJwt(jwt);
    expect(valid).toStrictEqual({
      iss: wmp.issuer,
      iat: getUnixTime(issuedAt),
      exp: getUnixTime(expiredAt),
      sub: wmp.credentialSubject.id,
      ...wmp,
    });
  });
});
describe("CA", () => {
  test("Advertisement CA", async () => {
    const issuedAt = new Date();
    const expiredAt = addYears(new Date(), 10);
    const ca: AdvertisementCA = {
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
          id: "https://ad.example.com/static/thumbnail.png",
          digestSRI: "sha256-...",
        },
        genre: "Arts & Entertainment",
        landingPageUrl: "https://ad.landingpage.example.com",
      },
      allowedOrigin: ["https://ad.example.com"],
      target: [
        {
          type: "ExternalResourceTargetIntegrity",
          integrity: "sha256-rLDPDYArkNcCvnq0h4IgR7MVfJIOCCrx4z+w+uywc64=",
        },
      ],
    };
    const { publicKey, privateKey } = await generateKey();
    const jwt = await signJwtVc(ca, privateKey, { issuedAt, expiredAt });
    expect(decodeProtectedHeader(jwt).kid).toBe(publicKey.kid);
    const valid = decodeJwt(jwt);
    expect(valid).toStrictEqual({
      iss: ca.issuer,
      iat: getUnixTime(issuedAt),
      exp: getUnixTime(expiredAt),
      sub: ca.credentialSubject.id,
      ...ca,
    });
  });

  test("Article CA", async () => {
    const issuedAt = new Date();
    const expiredAt = addYears(new Date(), 10);
    const ca: ArticleCA = {
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
        headline: "<Webページのタイトル>",
        image: {
          id: "https://media.example.com/image.png",
          digestSRI: "sha256-Upwn7gYMuRmJlD1ZivHk876vXHzokXrwXj50VgfnMnY=",
        },
        description: "<Webページの説明>",
        author: ["山田花子"],
        editor: ["山田太郎"],
        datePublished: "2023-07-04T19:14:00Z",
        dateModified: "2023-07-04T19:14:00Z",
        genre: "スポーツ",
      },
      allowedUrl: ["https://media.example.com/articles/2024-06-30"],
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
    const { publicKey, privateKey } = await generateKey();
    const jwt = await signJwtVc(ca, privateKey, { issuedAt, expiredAt });
    expect(decodeProtectedHeader(jwt).kid).toBe(publicKey.kid);
    const valid = decodeJwt(jwt);
    expect(valid).toStrictEqual({
      iss: ca.issuer,
      iat: getUnixTime(issuedAt),
      exp: getUnixTime(expiredAt),
      sub: ca.credentialSubject.id,
      ...ca,
    });
  });

  test("Advertorial CA", async () => {
    const issuedAt = new Date();
    const expiredAt = addYears(new Date(), 10);
    const ca: AdvertorialCA = {
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
        type: "Advertorial",
        headline: "<記事広告のタイトル>",
        image: {
          id: "https://media.example.com/image.png",
          digestSRI: "sha256-Upwn7gYMuRmJlD1ZivHk876vXHzokXrwXj50VgfnMnY=",
        },
        description: "<記事広告の説明>",
        author: ["山田花子"],
        editor: ["山田太郎"],
        sponsor: ["スポンサー"],
        datePublished: "2023-07-04T19:14:00Z",
        dateModified: "2023-07-04T19:14:00Z",
        genre: "スポーツ",
      },
      allowedUrl: ["https://media.example.com/articles/2024-06-30"],
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
    const { publicKey, privateKey } = await generateKey();
    const jwt = await signJwtVc(ca, privateKey, { issuedAt, expiredAt });
    expect(decodeProtectedHeader(jwt).kid).toBe(publicKey.kid);
    const valid = decodeJwt(jwt);
    expect(valid).toStrictEqual({
      iss: ca.issuer,
      iat: getUnixTime(issuedAt),
      exp: getUnixTime(expiredAt),
      sub: ca.credentialSubject.id,
      ...ca,
    });
  });
});
