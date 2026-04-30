import { generateKey } from "@originator-profile/cryptography";
import type { Jwk, UnsignedWebsiteProfile } from "@originator-profile/model";
import { decodeJwt } from "jose";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { SiteProfileInputSchema, signSiteProfile } from "./sign-site-profile";

let privateKey: Jwk;

beforeAll(async () => {
  const keys = await generateKey();
  privateKey = keys.privateKey;
});

function signingCtx() {
  const issuedAt = new Date();
  return {
    issuers: { "dns:example.com": privateKey },
    issuedAt,
    expiredAt: new Date(issuedAt.getFullYear() + 1, issuedAt.getMonth()),
  };
}

const sampleUwsp = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    { "@language": "en" },
  ],
  type: ["VerifiableCredential", "WebsiteProfile"],
  issuer: "dns:example.com",
  credentialSubject: {
    id: "https://example.com",
    type: "WebSite",
    name: "Example",
    image: {
      id: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
    },
    allowedOrigin: ["https://example.com"],
  },
} satisfies UnsignedWebsiteProfile;

describe("signSiteProfile", () => {
  test("sites 内の unsigned WSP を署名する", async () => {
    const input = { originators: [{ core: "eyJ..." }], sites: [sampleUwsp] };

    const output = await signSiteProfile(input, signingCtx(), "/tmp");

    expect(output.sites).toHaveLength(1);
    expect(output.sites[0].startsWith("eyJ")).toBe(true);
  });

  test("originators はそのままパススルーされる", async () => {
    const originators = [
      { core: "eyJfirst", annotations: ["eyJann"], media: ["eyJmedia"] },
      { core: "eyJsecond" },
    ];
    const input = { originators, sites: [sampleUwsp] };

    const output = await signSiteProfile(input, signingCtx(), "/tmp");

    expect(output.originators).toEqual(originators);
  });

  test("署名された JWT に iss, sub, iat, exp が含まれる", async () => {
    const input = { originators: [{ core: "eyJ..." }], sites: [sampleUwsp] };

    const output = await signSiteProfile(input, signingCtx(), "/tmp");
    const payload = decodeJwt(output.sites[0]);

    expect(payload.iss).toBe("dns:example.com");
    expect(payload.sub).toBe("https://example.com");
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  test("image の digestSRI が計算される", async () => {
    const input = { originators: [{ core: "eyJ..." }], sites: [sampleUwsp] };

    const output = await signSiteProfile(input, signingCtx(), "/tmp");
    const payload = decodeJwt(output.sites[0]);
    const image = (
      payload.credentialSubject as { image?: { digestSRI?: string } }
    ).image;
    expect(image?.digestSRI).toMatch(/^sha256-/);
  });

  test("image のローカルパスが解決される", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "sign-sp-test-"));
    mkdirSync(join(tempDir, "images"), { recursive: true });
    writeFileSync(
      join(tempDir, "images", "logo.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    );

    const uwsp = {
      ...sampleUwsp,
      credentialSubject: {
        ...sampleUwsp.credentialSubject,
        image: {
          id: "https://example.com/logo.svg",
          content: "./images/logo.svg",
        },
      },
    };
    const input = { originators: [{ core: "eyJ..." }], sites: [uwsp] };

    const output = await signSiteProfile(input, signingCtx(), tempDir);
    const payload = decodeJwt(output.sites[0]);
    const image = (
      payload.credentialSubject as { image?: { digestSRI?: string } }
    ).image;
    expect(image?.digestSRI).toMatch(/^sha256-/);
  });

  test("複数言語の WSP を一括署名", async () => {
    const en = { ...sampleUwsp };
    const ja = {
      ...sampleUwsp,
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
    } satisfies UnsignedWebsiteProfile;
    const input = { originators: [{ core: "eyJ..." }], sites: [en, ja] };

    const output = await signSiteProfile(input, signingCtx(), "/tmp");

    expect(output.sites).toHaveLength(2);
    expect(output.sites[0].startsWith("eyJ")).toBe(true);
    expect(output.sites[1].startsWith("eyJ")).toBe(true);
  });

  test("originators が空の場合スキーマバリデーションエラー", () => {
    const input = { originators: [], sites: [sampleUwsp] };
    expect(() => SiteProfileInputSchema.parse(input)).toThrow(
      "originators must not be empty",
    );
  });

  test("sites が空の場合スキーマバリデーションエラー", () => {
    const input = { originators: [{ core: "eyJ..." }], sites: [] };
    expect(() => SiteProfileInputSchema.parse(input)).toThrow(
      "sites must not be empty",
    );
  });

  test("入力 sites の uwsp オブジェクトを破壊的に変更しない", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "sign-sp-test-"));
    writeFileSync(join(tempDir, "logo.svg"), "<svg></svg>");

    const uwsp = {
      ...sampleUwsp,
      credentialSubject: {
        ...sampleUwsp.credentialSubject,
        image: {
          id: "https://example.com/logo.svg",
          content: "./logo.svg",
        },
      },
    };
    const original = structuredClone(uwsp);
    const input = { originators: [{ core: "eyJ..." }], sites: [uwsp] };

    await signSiteProfile(input, signingCtx(), tempDir);

    expect(uwsp).toEqual(original);
  });

  test("未登録の issuer はエラー", async () => {
    const input = { originators: [{ core: "eyJ..." }], sites: [sampleUwsp] };
    const ctx = { ...signingCtx(), issuers: {} };

    await expect(signSiteProfile(input, ctx, "/tmp")).rejects.toThrow(
      'No signing key found for issuer "dns:example.com"',
    );
  });
});
