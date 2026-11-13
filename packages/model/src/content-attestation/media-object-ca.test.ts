import { describe, expect, test } from "vitest";
import { AudioCA } from "./audio-ca";
import { DocumentCA } from "./document-ca";
import { ImageCA } from "./image-ca";
import { VideoCA } from "./video-ca";

const createCa = (type: string, encodingFormat: string) => ({
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
    type,
    name: "<タイトル>",
    image: {
      id: "https://media.example.com/image.png",
      digestSRI: "sha256-WNn1owxcJX6uwrNFOhPX+npz4j46s3a1cExjX5wWVxw=",
    },
    description: "<説明>",
    dateCreated: "2023-07-04T19:14:00Z",
    dateModified: "2023-07-04T19:14:00Z",
    creator: ["山田花子"],
    encodingFormat,
    genre: "Arts & Entertainment",
  },
  allowedUrl: ["https://media.example.com/*"],
  target: [
    {
      type: "ExternalResourceTargetIntegrity",
      integrity: "sha256-+M3dMZXeSIwAP8BsIAwxn5ofFWUtaoSoDfB+/J8uXMo=",
    },
  ],
});

describe.each([
  { schema: ImageCA, type: "Image", encodingFormat: "image/png" },
  { schema: VideoCA, type: "Video", encodingFormat: "video/mp4" },
  { schema: AudioCA, type: "Audio", encodingFormat: "audio/mpeg" },
  { schema: DocumentCA, type: "Document", encodingFormat: "application/pdf" },
])("$type CA", ({ schema, type, encodingFormat }) => {
  test("仕様の例を受け入れる", () => {
    const ca = createCa(type, encodingFormat);
    expect(schema.parse(ca)).toStrictEqual(ca);
  });

  test("必須プロパティのみで受け入れる", () => {
    const ca = createCa(type, encodingFormat);
    const { id, name, description } = ca.credentialSubject;
    const result = schema.safeParse({
      ...ca,
      credentialSubject: { id, type, name, description },
    });
    expect(result.success).toBe(true);
  });

  test.each(["id", "name", "description"] as const)(
    "%s が無ければ拒否する",
    (key) => {
      const ca = createCa(type, encodingFormat);
      const { [key]: _, ...credentialSubject } = ca.credentialSubject;
      const result = schema.safeParse({ ...ca, credentialSubject });
      expect(result.success).toBe(false);
    },
  );

  test("type が異なれば拒否する", () => {
    const ca = createCa("Article", encodingFormat);
    expect(schema.safeParse(ca).success).toBe(false);
  });

  test("dateCreated が dateTimeStamp でなければ拒否する", () => {
    const ca = createCa(type, encodingFormat);
    const result = schema.safeParse({
      ...ca,
      credentialSubject: {
        ...ca.credentialSubject,
        dateCreated: "2023-07-04T19:14:00",
      },
    });
    expect(result.success).toBe(false);
  });

  test("target が空配列なら拒否する", () => {
    const ca = createCa(type, encodingFormat);
    expect(schema.safeParse({ ...ca, target: [] }).success).toBe(false);
  });
});
