import { generateKey } from "@originator-profile/cryptography";
import type { Jwk, UnsignedWebsiteProfile } from "@originator-profile/model";
import { BadRequestError } from "http-errors-enhanced";
import { decodeJwt } from "jose";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { sign, unsignedWsp } from "./website-profile.ts";

const { privateKey: testPrivateKey } = await generateKey();

function baseUwsp(language: string): UnsignedWebsiteProfile {
  return {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      { "@language": language },
    ],
    type: ["VerifiableCredential", "WebsiteProfile"],
    issuer: "dns:example.com",
    credentialSubject: {
      id: "https://example.com",
      type: "WebSite",
      name: `Example ${language}`,
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

const createUnsignedWebsiteProfile = () => baseUwsp("ja-JP");

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

await describe("unsignedWsp() 配列入力", async () => {
  await test("多言語の配列を受け付け、各要素に iss/sub/iat/exp が付与される", async () => {
    const uwsps = [baseUwsp("ja"), baseUwsp("en")];

    const result = await unsignedWsp(uwsps, {});

    assert.equal(result.length, 2);
    for (const item of result) {
      assert.equal(item.iss, "dns:example.com");
      assert.equal(item.sub, "https://example.com");
      assert.ok(item.iat);
      assert.ok(item.exp);
    }
    assert.notEqual(
      (result[0]["@context"].at(-1) as { "@language": string })["@language"],
      (result[1]["@context"].at(-1) as { "@language": string })["@language"],
    );
  });

  await test("空配列の場合 BadRequestError", async () => {
    await assert.rejects(unsignedWsp([], {}), BadRequestError);
  });

  await test("issuer が要素間で異なる場合 BadRequestError", async () => {
    const ja = baseUwsp("ja");
    const en = baseUwsp("en");
    en.issuer = "dns:another.example.com";

    await assert.rejects(unsignedWsp([ja, en], {}), BadRequestError);
  });

  await test("credentialSubject.id が要素間で異なる場合 BadRequestError", async () => {
    const ja = baseUwsp("ja");
    const en = baseUwsp("en");
    en.credentialSubject.id = "https://another.example.com";

    await assert.rejects(unsignedWsp([ja, en], {}), BadRequestError);
  });

  await test("@language が重複する場合 BadRequestError", async () => {
    await assert.rejects(
      unsignedWsp([baseUwsp("ja"), baseUwsp("ja")], {}),
      BadRequestError,
    );
  });

  await test("配列要素に @language がない場合 BadRequestError", async () => {
    const noLang = {
      ...baseUwsp("ja"),
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
      ],
    } as unknown as UnsignedWebsiteProfile;

    await assert.rejects(
      unsignedWsp([baseUwsp("ja"), noLang], {}),
      BadRequestError,
    );
  });
});

await describe("sign() 戻り値", async () => {
  await test("単一入力は JWT 文字列を返す", async () => {
    const jwt = await sign(baseUwsp("ja"), testPrivateKey, {});

    assert.equal(typeof jwt, "string");
    const payload = decodeJwt(jwt);
    assert.equal(payload.iss, "dns:example.com");
    assert.equal(payload.sub, "https://example.com");
  });

  await test("配列入力は JWT 文字列の配列を返す", async () => {
    const result = await sign(
      [baseUwsp("ja"), baseUwsp("en")],
      testPrivateKey,
      {},
    );

    assert.equal(result.length, 2);

    const [jaPayload, enPayload] = result.map((jwt) => decodeJwt(jwt));
    assert.equal(jaPayload.iss, "dns:example.com");
    assert.equal(enPayload.iss, "dns:example.com");

    const jaContext = (jaPayload as { "@context": unknown[] })["@context"];
    const enContext = (enPayload as { "@context": unknown[] })["@context"];
    assert.deepEqual(jaContext.at(-1), { "@language": "ja" });
    assert.deepEqual(enContext.at(-1), { "@language": "en" });
  });
});
