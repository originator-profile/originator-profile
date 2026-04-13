import { generateKey } from "@originator-profile/cryptography";
import type {
  Jwk,
  UnsignedContentAttestation,
} from "@originator-profile/model";
import { decodeJwt } from "jose";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { signCas } from "./sign-cas";

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

const sampleUca = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    { "@language": "en" },
  ],
  type: ["VerifiableCredential", "ContentAttestation"],
  issuer: "dns:example.com",
  credentialSubject: {
    id: "urn:uuid:78550fa7-f846-4e0f-ad5c-8d34461cb95b",
    type: "Article",
    headline: "Test Article",
    description: "test description",
  },
  target: [
    {
      type: "TextTargetIntegrity",
      cssSelector: "#main",
      content: 'data:text/html,<div id="main">Hello, world!</div>',
    },
  ],
} satisfies UnsignedContentAttestation;

describe("signCas", () => {
  test("unsigned CA を署名して JWT 文字列を返す", async () => {
    const result = await signCas([sampleUca], signingCtx(), "/tmp");

    expect(result).toHaveLength(1);
    expect(typeof result[0]).toBe("string");
    expect((result[0] as string).startsWith("eyJ")).toBe(true);
  });

  test("署名された JWT に target integrity が含まれる", async () => {
    const result = await signCas([sampleUca], signingCtx(), "/tmp");

    const payload = decodeJwt(result[0] as string);
    const target = (payload.target as Array<{ integrity?: string }>)[0];
    expect(target.integrity).toMatch(/^sha256-/);
  });

  test("main: true のエントリは { attestation, main } で出力", async () => {
    const entry = { ...sampleUca, main: true };
    const result = await signCas([entry], signingCtx(), "/tmp");

    const output = result[0] as { attestation: string; main: true };
    expect(output.main).toBe(true);
    expect(output.attestation.startsWith("eyJ")).toBe(true);
  });

  test("main なしと main: true が混在", async () => {
    const entries = [sampleUca, { ...sampleUca, main: true }];
    const result = await signCas(entries, signingCtx(), "/tmp");

    expect(typeof result[0]).toBe("string");
    expect((result[1] as { main: boolean }).main).toBe(true);
  });

  test("image のローカルパスが Data URL に変換される", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "sign-cas-test-"));
    mkdirSync(join(tempDir, "images"), { recursive: true });
    writeFileSync(
      join(tempDir, "images", "logo.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    );

    const entry = {
      ...sampleUca,
      credentialSubject: {
        ...sampleUca.credentialSubject,
        image: {
          id: "https://example.com/logo.svg",
          content: "./images/logo.svg",
        },
      },
    };

    const result = await signCas([entry], signingCtx(), tempDir);
    const payload = decodeJwt(result[0] as string);
    const image = (
      payload.credentialSubject as { image?: { digestSRI?: string } }
    ).image;
    expect(image?.digestSRI).toMatch(/^sha256-/);
  });

  test("ExternalResourceTarget のローカルパスが解決される", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "sign-cas-test-"));
    writeFileSync(join(tempDir, "photo.png"), "fake-png-bytes");

    const entry: UnsignedContentAttestation & { main?: boolean } = {
      ...sampleUca,
      target: [
        {
          type: "ExternalResourceTargetIntegrity",
          content: "./photo.png",
        },
      ],
    };

    const result = await signCas([entry], signingCtx(), tempDir);
    const payload = decodeJwt(result[0] as string);
    const target = (payload.target as Array<{ integrity?: string }>)[0];
    expect(target.integrity).toMatch(/^sha256-/);
  });

  test("html パラメータ渡しで HtmlTargetIntegrity の content が自動設定される", async () => {
    const entry = {
      ...sampleUca,
      target: [
        {
          type: "HtmlTargetIntegrity" as const,
          cssSelector: "#main",
        },
      ],
    };
    const html = '<html><body><div id="main">Hello</div></body></html>';

    const result = await signCas([entry], signingCtx(), "/tmp", html);
    const payload = decodeJwt(result[0] as string);
    const target = (payload.target as Array<{ integrity?: string }>)[0];
    expect(target.integrity).toMatch(/^sha256-/);
  });

  test("integrity が既に設定済みの DOM target は html パラメータの影響を受けない", async () => {
    const entry = {
      ...sampleUca,
      target: [
        {
          type: "HtmlTargetIntegrity" as const,
          cssSelector: "#main",
          integrity: "sha256-existing",
        },
      ],
    };
    const html = '<html><body><div id="main">Hello</div></body></html>';

    const result = await signCas([entry], signingCtx(), "/tmp", html);
    const payload = decodeJwt(result[0] as string);
    const target = (payload.target as Array<{ integrity?: string }>)[0];
    expect(target.integrity).toBe("sha256-existing");
  });

  test("html パラメータなしでは DOM target の content は自動設定されない", async () => {
    const entry = {
      ...sampleUca,
      target: [
        {
          type: "HtmlTargetIntegrity" as const,
          cssSelector: "#main",
          integrity: "sha256-preset",
        },
      ],
    };

    const result = await signCas([entry], signingCtx(), "/tmp");
    const payload = decodeJwt(result[0] as string);
    const target = (payload.target as Array<{ integrity?: string }>)[0];
    expect(target.integrity).toBe("sha256-preset");
  });

  test("未登録の issuer はエラー", async () => {
    const ctx = { ...signingCtx(), issuers: {} };

    await expect(signCas([sampleUca], ctx, "/tmp")).rejects.toThrow(
      'No signing key found for issuer "dns:example.com"',
    );
  });
});
