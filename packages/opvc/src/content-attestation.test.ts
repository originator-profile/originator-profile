import type {
  Image,
  Jwk,
  UnsignedContentAttestation,
} from "@originator-profile/model";
import assert from "assert";
import { BadRequestError } from "http-errors-enhanced";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { createIntegrityMetadata } from "websri";
import { sign, signByServer, unsignedCa } from "./content-attestation.ts";

function createUnsignedContentAttestation(): UnsignedContentAttestation {
  return {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      {
        "@language": "ja-JP",
      },
    ],
    type: ["VerifiableCredential", "ContentAttestation"],
    issuer: "dns:localhost",
    credentialSubject: {
      id: "urn:uuid:4e4abf74-08da-41aa-9063-e84b9c125bc6",
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
  };
}

await describe("unsignedCa()", async () => {
  await test("単一文字列 content の target に対して integrity が計算される", async () => {
    const content = 'data:text/html,<div id="main">Hello, world!</div>';

    const uca = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        {
          "@language": "ja-JP",
        },
      ],
      type: ["VerifiableCredential", "ContentAttestation"],
      issuer: "dns:localhost",
      credentialSubject: {
        id: "urn:uuid:4e4abf74-08da-41aa-9063-e84b9c125bc6",
        type: "Article",
        headline: "Test Article",
        description: "test description",
      },
      target: [
        {
          type: "TextTargetIntegrity",
          cssSelector: "#main",
          content,
        },
      ],
    } satisfies UnsignedContentAttestation;

    const result = await unsignedCa(uca, {});

    // TextTargetIntegrity は DOM のテキストコンテンツ "Hello, world!" から計算
    const textContent = "Hello, world!";
    const meta = await createIntegrityMetadata(
      "sha256",
      new TextEncoder().encode(textContent).buffer as ArrayBuffer,
    );
    assert.strictEqual(result.target[0].integrity, meta.toString());
  });

  await test("配列 content の image に対して digestSRI が計算される", async () => {
    const content = [
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
    ];

    const meta = await createIntegrityMetadata(
      "sha256",
      await fetch(content[0]).then((res) => res.arrayBuffer()),
    );

    const uca = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        {
          "@language": "ja-JP",
        },
      ],
      type: ["VerifiableCredential", "ContentAttestation"],
      issuer: "dns:localhost",
      credentialSubject: {
        id: "urn:uuid:4e4abf74-08da-41aa-9063-e84b9c125bc6",
        type: "Article",
        headline: "Test Article",
        description: "test description",
        image: {
          id: "https://example.com/image.svg",
          content,
        },
      },
      target: [
        {
          type: "TextTargetIntegrity",
          cssSelector: "#main",
          content: 'data:text/html,<div id="main">test</div>',
        },
      ],
    } satisfies UnsignedContentAttestation;

    const result = await unsignedCa(uca, {});

    const image = result.credentialSubject.image as Image | undefined;
    assert.strictEqual(image?.digestSRI, meta.toString());
    assert.strictEqual((image as { content?: unknown })?.content, undefined);
  });

  await test("複数コンテンツに対応するSRIハッシュがすべて含まれる", async () => {
    const content = ["data:text/plain,content1", "data:text/plain,content2"];

    const meta1 = await createIntegrityMetadata(
      "sha256",
      await fetch(content[0]).then((res) => res.arrayBuffer()),
    );
    const meta2 = await createIntegrityMetadata(
      "sha256",
      await fetch(content[1]).then((res) => res.arrayBuffer()),
    );

    const uca = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        {
          "@language": "ja-JP",
        },
      ],
      type: ["VerifiableCredential", "ContentAttestation"],
      issuer: "dns:localhost",
      credentialSubject: {
        id: "urn:uuid:4e4abf74-08da-41aa-9063-e84b9c125bc6",
        type: "Article",
        headline: "Test Article",
        description: "test description",
      },
      target: [
        {
          type: "ExternalResourceTargetIntegrity",
          content,
        },
      ],
    } satisfies UnsignedContentAttestation;

    const result = await unsignedCa(uca, {});

    assert.strictEqual(
      result.target[0].integrity,
      `${meta1.toString()} ${meta2.toString()}`,
    );
  });

  await test("type に ContentAttestation を含まない場合 Error", async () => {
    const uca = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
      ],
      type: ["VerifiableCredential"],
      issuer: "dns:example.com",
      credentialSubject: { id: "urn:uuid:test", type: "Article" },
      target: [{ type: "TextTargetIntegrity", content: "data:text/html,test" }],
    };

    await assert.rejects(
      unsignedCa(uca as unknown as UnsignedContentAttestation, {}),
      Error,
    );
  });

  await test("issuer が不正な OP ID の場合 Error", async () => {
    const uca = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
      ],
      type: ["VerifiableCredential", "ContentAttestation"],
      issuer: "invalid-issuer",
      credentialSubject: { id: "urn:uuid:test", type: "Article" },
      target: [{ type: "TextTargetIntegrity", content: "data:text/html,test" }],
    };

    await assert.rejects(
      unsignedCa(uca as unknown as UnsignedContentAttestation, {}),
      Error,
    );
  });

  await test("target が空配列の場合 Error", async () => {
    const uca = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
      ],
      type: ["VerifiableCredential", "ContentAttestation"],
      issuer: "dns:example.com",
      credentialSubject: { id: "urn:uuid:test", type: "Article" },
      target: [],
    };

    await assert.rejects(
      unsignedCa(uca as unknown as UnsignedContentAttestation, {}),
      Error,
    );
  });

  await test("@context に必須コンテキストが不足している場合 Error", async () => {
    const uca = {
      "@context": ["https://www.w3.org/ns/credentials/v2"],
      type: ["VerifiableCredential", "ContentAttestation"],
      issuer: "dns:example.com",
      credentialSubject: { id: "urn:uuid:test", type: "Article" },
      target: [{ type: "TextTargetIntegrity", content: "data:text/html,test" }],
    };

    await assert.rejects(
      unsignedCa(uca as unknown as UnsignedContentAttestation, {}),
      Error,
    );
  });

  await test("無効な issuedAt は BadRequestError になる", async () => {
    await assert.rejects(
      unsignedCa(createUnsignedContentAttestation(), {
        issuedAt: "not-a-date",
      }),
      BadRequestError,
    );
  });

  await test("無効な expiredAt は BadRequestError になる", async () => {
    await assert.rejects(
      unsignedCa(createUnsignedContentAttestation(), {
        expiredAt: "not-a-date",
      }),
      BadRequestError,
    );
  });
});

await describe("sign()", async () => {
  await test("type に ContentAttestation を含まない場合 Error", async () => {
    const uca = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
      ],
      type: ["VerifiableCredential"],
      issuer: "dns:example.com",
      credentialSubject: { id: "urn:uuid:test", type: "Article" },
      target: [{ type: "TextTargetIntegrity", content: "data:text/html,test" }],
    };

    await assert.rejects(
      sign(uca as unknown as UnsignedContentAttestation, {} as Jwk, {}),
      Error,
    );
  });

  await test("issuer が不正な OP ID の場合 Error", async () => {
    const uca = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
      ],
      type: ["VerifiableCredential", "ContentAttestation"],
      issuer: "not-a-dns-id",
      credentialSubject: { id: "urn:uuid:test", type: "Article" },
      target: [{ type: "TextTargetIntegrity", content: "data:text/html,test" }],
    };

    await assert.rejects(
      sign(uca as unknown as UnsignedContentAttestation, {} as Jwk, {}),
      Error,
    );
  });

  await test("target が空配列の場合 Error", async () => {
    const uca = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
      ],
      type: ["VerifiableCredential", "ContentAttestation"],
      issuer: "dns:example.com",
      credentialSubject: { id: "urn:uuid:test", type: "Article" },
      target: [],
    };

    await assert.rejects(
      sign(uca as unknown as UnsignedContentAttestation, {} as Jwk, {}),
      Error,
    );
  });
});

await describe("signByServer()", async () => {
  const endpoint = "https://example.com/ca";
  const originalFetch = globalThis.fetch;
  let request:
    | {
        input: RequestInfo | URL;
        init?: RequestInit;
      }
    | undefined;
  let endpointResponse:
    | ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>)
    | undefined;

  beforeEach(() => {
    request = undefined;
    endpointResponse = undefined;

    mock.method(
      globalThis,
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (input === endpoint) {
          request = { input, init };

          if (endpointResponse) {
            return await endpointResponse(input, init);
          }
        }

        return await originalFetch(input, init);
      },
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  await test("Bearer 認証付きで CA server に POST し先頭 JWT を返す", async () => {
    const accessToken = "test-access-token";
    endpointResponse = async () =>
      new Response(JSON.stringify(["jwt-1", "jwt-2"]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });

    const jwt = await signByServer(createUnsignedContentAttestation(), {
      endpoint,
      accessToken,
    });

    assert.strictEqual(jwt, "jwt-1");
    assert.strictEqual(request?.input, endpoint);
    assert.strictEqual(request?.init?.method, "POST");
    assert.deepStrictEqual(request?.init?.headers, {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    });

    const requestBody = request?.init?.body;
    if (typeof requestBody !== "string") {
      throw new TypeError("Expected request body to be a JSON string.");
    }
    const body = JSON.parse(requestBody) as {
      iss: string;
      sub: string;
      iat: number;
      exp: number;
      target: Array<{ integrity?: string; content?: unknown }>;
    };
    assert.strictEqual(body.iss, "dns:localhost");
    assert.strictEqual(
      body.sub,
      "urn:uuid:4e4abf74-08da-41aa-9063-e84b9c125bc6",
    );
    assert.strictEqual(typeof body.iat, "number");
    assert.strictEqual(typeof body.exp, "number");
    assert.ok(body.target[0].integrity);
    assert.strictEqual(body.target[0].content, undefined);
  });

  await test("CA server が文字列 JWT を直接返した場合はそのまま返す", async () => {
    endpointResponse = async () =>
      new Response("jwt-direct", {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
      });

    const jwt = await signByServer(createUnsignedContentAttestation(), {
      endpoint,
      accessToken: "test-access-token",
    });

    assert.strictEqual(jwt, "jwt-direct");
  });

  await test("CA server が JSON 文字列の JWT を返した場合は展開して返す", async () => {
    endpointResponse = async () =>
      new Response(JSON.stringify("jwt-direct"), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });

    const jwt = await signByServer(createUnsignedContentAttestation(), {
      endpoint,
      accessToken: "test-access-token",
    });

    assert.strictEqual(jwt, "jwt-direct");
  });

  await test("非 2xx 応答はエラーになる", async () => {
    endpointResponse = async () =>
      new Response("forbidden", {
        status: 403,
        statusText: "Forbidden",
      });

    await assert.rejects(
      signByServer(createUnsignedContentAttestation(), {
        endpoint,
        accessToken: "test-access-token",
      }),
      Error,
    );
  });

  await test("空レスポンス配列はエラーになる", async () => {
    endpointResponse = async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });

    await assert.rejects(
      signByServer(createUnsignedContentAttestation(), {
        endpoint,
        accessToken: "test-access-token",
      }),
      Error,
    );
  });

  await test("fetch が例外を投げた場合はそのまま reject される", async () => {
    endpointResponse = async () => {
      throw new TypeError("network down");
    };

    await assert.rejects(
      signByServer(createUnsignedContentAttestation(), {
        endpoint,
        accessToken: "test-access-token",
      }),
      Error,
    );
  });
});
