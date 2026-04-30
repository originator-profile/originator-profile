import type { Jwk, UnsignedWebsiteProfile } from "@originator-profile/model";
import { BadRequestError } from "http-errors-enhanced";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { sign, unsignedWsp } from "./website-profile.ts";

function createUnsignedWebsiteProfile(): UnsignedWebsiteProfile {
  return {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      { "@language": "ja" },
    ],
    type: ["VerifiableCredential", "WebsiteProfile"],
    issuer: "dns:example.com",
    credentialSubject: {
      id: "https://example.com",
      type: "WebSite",
      name: "Example",
      image: {
        id: "https://example.com/image.png",
        content: [
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
        ],
      },
      allowedOrigin: ["https://example.com"],
    },
  };
}

await describe("unsignedWsp()", async () => {
  await test("有効な UnsignedWebsiteProfile を受け付ける", async () => {
    const uwsp = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "WebsiteProfile"],
      issuer: "dns:example.com",
      credentialSubject: {
        id: "https://example.com",
        type: "WebSite",
        name: "Example",
        image: {
          id: "https://example.com/image.png",
          content: [
            "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
          ],
        },
        allowedOrigin: ["https://example.com"],
      },
    } satisfies UnsignedWebsiteProfile;

    const result = await unsignedWsp(uwsp, {});

    assert.equal(result.iss, "dns:example.com");
    assert.equal(result.sub, "https://example.com");
    assert.ok(result.iat);
    assert.ok(result.exp);
  });

  await test("credentialSubject.image が欠落していても受け付ける", async () => {
    const uwsp = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "WebsiteProfile"],
      issuer: "dns:example.com",
      credentialSubject: {
        id: "https://example.com",
        type: "WebSite",
        name: "Example",
        allowedOrigin: ["https://example.com"],
      },
    } satisfies UnsignedWebsiteProfile;

    const result = await unsignedWsp(uwsp, {});

    assert.equal(result.credentialSubject.id, "https://example.com");
  });

  await test("type に WebsiteProfile を含まない場合 BadRequestError", async () => {
    const uwsp = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "SomethingElse"],
      issuer: "dns:example.com",
      credentialSubject: {
        id: "https://example.com",
        type: "WebSite",
        name: "Example",
        image: {
          id: "https://example.com/image.png",
          content: ["data:image/svg+xml;base64,dGVzdA=="],
        },
        allowedOrigin: ["https://example.com"],
      },
    };

    await assert.rejects(
      unsignedWsp(uwsp as unknown as UnsignedWebsiteProfile, {}),
      BadRequestError,
    );
  });

  await test("issuer が不正な OP ID の場合 BadRequestError", async () => {
    const uwsp = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "WebsiteProfile"],
      issuer: "invalid-issuer",
      credentialSubject: {
        id: "https://example.com",
        type: "WebSite",
        name: "Example",
        image: {
          id: "https://example.com/image.png",
          content: ["data:image/svg+xml;base64,dGVzdA=="],
        },
        allowedOrigin: ["https://example.com"],
      },
    };

    await assert.rejects(
      unsignedWsp(uwsp as unknown as UnsignedWebsiteProfile, {}),
      BadRequestError,
    );
  });

  await test("@context に必須コンテキストが不足している場合 BadRequestError", async () => {
    const uwsp = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        // OP credentials v1 が不足
      ],
      type: ["VerifiableCredential", "WebsiteProfile"],
      issuer: "dns:example.com",
      credentialSubject: {
        id: "https://example.com",
        type: "WebSite",
        name: "Example",
        image: {
          id: "https://example.com/image.png",
          content: ["data:image/svg+xml;base64,dGVzdA=="],
        },
        allowedOrigin: ["https://example.com"],
      },
    };

    await assert.rejects(
      unsignedWsp(uwsp as unknown as UnsignedWebsiteProfile, {}),
      BadRequestError,
    );
  });

  await test("allowedOrigin が不正な形式の場合 BadRequestError", async () => {
    const uwsp = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "WebsiteProfile"],
      issuer: "dns:example.com",
      credentialSubject: {
        id: "https://example.com",
        type: "WebSite",
        name: "Example",
        image: {
          id: "https://example.com/image.png",
          content: ["data:image/svg+xml;base64,dGVzdA=="],
        },
        allowedOrigin: ["https://example.com/with-path"],
      },
    };

    await assert.rejects(
      unsignedWsp(uwsp as unknown as UnsignedWebsiteProfile, {}),
      BadRequestError,
    );
  });

  await test("無効な issuedAt は BadRequestError になる", async () => {
    const uwsp = createUnsignedWebsiteProfile();

    await assert.rejects(
      unsignedWsp(uwsp, { issuedAt: "not-a-date" }),
      BadRequestError,
    );
  });

  await test("無効な expiredAt は BadRequestError になる", async () => {
    const uwsp = createUnsignedWebsiteProfile();

    await assert.rejects(
      unsignedWsp(uwsp, { expiredAt: "not-a-date" }),
      BadRequestError,
    );
  });
});

await describe("sign()", async () => {
  await test("type に WebsiteProfile を含まない場合 BadRequestError", async () => {
    const uwsp = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "SomethingElse"],
      issuer: "dns:example.com",
      credentialSubject: {
        id: "https://example.com",
        type: "WebSite",
        name: "Example",
        allowedOrigin: ["https://example.com"],
      },
    };

    await assert.rejects(
      sign(uwsp as unknown as UnsignedWebsiteProfile, {} as Jwk, {}),
      BadRequestError,
    );
  });

  await test("issuer が不正な OP ID の場合 BadRequestError", async () => {
    const uwsp = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
      type: ["VerifiableCredential", "WebsiteProfile"],
      issuer: "not-a-dns-id",
      credentialSubject: {
        id: "https://example.com",
        type: "WebSite",
        name: "Example",
        allowedOrigin: ["https://example.com"],
      },
    };

    await assert.rejects(
      sign(uwsp as unknown as UnsignedWebsiteProfile, {} as Jwk, {}),
      BadRequestError,
    );
  });
});
