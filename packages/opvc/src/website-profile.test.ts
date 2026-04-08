import type { UnsignedWebsiteProfile } from "@originator-profile/model";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { unsignedWsp } from "./website-profile.ts";

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

  await test("type に WebsiteProfile を含まない場合 Error", async () => {
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
      Error,
    );
  });

  await test("issuer が不正な OP ID の場合 Error", async () => {
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
      Error,
    );
  });

  await test("@context に必須コンテキストが不足している場合 Error", async () => {
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
      Error,
    );
  });

  await test("allowedOrigin が不正な形式の場合 Error", async () => {
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
      Error,
    );
  });
});
