import type {
  Image,
  UnsignedContentAttestation,
} from "@originator-profile/model";
import assert from "assert";
import { describe, test } from "node:test";
import { createIntegrityMetadata } from "websri";
import { unsignedCa } from "./content-attestation.ts";

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
});
