import type { UnsignedContentAttestation } from "@originator-profile/model";
import assert from "assert";
import { describe, test } from "node:test";
import { createIntegrityMetadata } from "websri";
import { unsignedCa } from "./content-attestation.ts";

await describe("unsignedCa()", async () => {
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
