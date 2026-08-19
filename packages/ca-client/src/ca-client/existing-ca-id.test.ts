import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { readExistingCaId } from "./existing-ca-id";

const b64u = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const casFileContent = (id: string): string => {
  const payload = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
    ],
    type: ["VerifiableCredential", "ContentAttestation"],
    issuer: "dns:techdev.originator-profile.org",
    iss: "dns:techdev.originator-profile.org",
    sub: id,
    credentialSubject: {
      id,
      type: "Article",
      headline: "x",
    },
    allowedUrl: ["https://example.com/(/?)"],
    target: [
      {
        type: "TextTargetIntegrity",
        cssSelector: "x",
        integrity: "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      },
    ],
    iat: 1700000000,
    exp: 1800000000,
  };
  const jwt = `${b64u({ alg: "ES256", typ: "JWT" })}.${b64u(payload)}.SIG`;
  return JSON.stringify([jwt]);
};

test("readExistingCaId: returns credentialSubject.id from an existing CAS", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cas-existing-id-"));
  try {
    const id = "urn:uuid:11111111-2222-3333-4444-555555555555";
    await writeFile(join(dir, "ja-JP.about.cas.json"), casFileContent(id));

    expect(await readExistingCaId("ja-JP.about.cas.json", dir)).toBe(id);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readExistingCaId: returns undefined when the file is missing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cas-existing-id-"));
  try {
    expect(await readExistingCaId("missing.cas.json", dir)).toBeUndefined();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
