import { FromSchema, JSONSchema } from "json-schema-to-ts";
import { AllowedUrl } from "../allowed-url";
import { OpCipContext } from "../context/op-cip-context";
import { Image } from "../image";
import { ContentAttestation } from "./content-attestation";

const subject = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: {
      type: "string",
      format: "uri",
      description: "CA ID",
    },
    type: {
      type: "string",
      const: "Advertorial",
    },
    headline: {
      type: "string",
      description: "記事広告のタイトル。",
    },
    description: {
      type: "string",
      description: "記事広告の説明（文字列）。",
    },
    image: Image,
    datePublished: {
      title: "公開日時",
      type: "string",
      description: "http://www.w3.org/2001/XMLSchema#dateTime 形式の公開日時",
    },
    dateModified: {
      title: "最終更新日時",
      type: "string",
      description:
        "http://www.w3.org/2001/XMLSchema#dateTime 形式の最終更新日時",
    },
    author: {
      title: "著者名",
      type: "array",
      items: {
        type: "string",
      },
    },
    editor: {
      title: "編集者名",
      type: "array",
      items: {
        type: "string",
      },
    },
    sponsor: {
      title: "スポンサー名",
      type: "array",
      items: {
        type: "string",
      },
    },
    genre: {
      title: "ジャンル",
      type: "string",
    },
  },
  required: ["id", "type", "headline", "description"],
} as const satisfies JSONSchema;

export const AdvertorialCA = {
  type: "object",
  additionalProperties: true,
  allOf: [
    ContentAttestation,
    {
      type: "object",
      additionalProperties: true,
      properties: {
        "@context": OpCipContext,
        credentialSubject: subject,
        allowedUrl: AllowedUrl,
      },
      required: ["@context", "type", "credentialSubject", "allowedUrl"],
    },
  ],
  not: {
    properties: {
      allowedOrigin: {},
    },
    required: ["allowedOrigin"],
  },
} as const satisfies JSONSchema;

export type AdvertorialCA = FromSchema<typeof AdvertorialCA>;
