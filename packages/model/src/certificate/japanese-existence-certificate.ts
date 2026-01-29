import { FromSchema, JSONSchema } from "json-schema-to-ts";
import { OpCipContext } from "../context/op-cip-context";
import { OpVc } from "../op-vc";
import { CertificationSystem } from "./cert-system";

export const JapaneseExistenceCertificateProperties = {
  type: "object",
  properties: {
    id: { type: "string", title: "subject の OP ID", format: "uri" },
    type: { type: "string", const: "JP-OrganizationExistenceCertificate" },
    name: {
      title: "法人名",
      type: "string",
    },
    description: { type: "string", title: "説明" },
    corporateNumber: {
      title: "法人番号",
      type: "string",
    },
    postalCode: {
      title: "郵便番号",
      type: "string",
    },
    addressCountry: {
      title: "国",
      type: "string",
    },
    addressRegion: {
      title: "都道府県",
      type: "string",
    },
    addressLocality: {
      title: "市区町村",
      type: "string",
    },
    streetAddress: {
      title: "番地・ビル名",
      type: "string",
    },
    certificationSystem: CertificationSystem,
  },
  required: [
    "id",
    "type",
    "name",
    "corporateNumber",
    "postalCode",
    "addressCountry",
    "addressRegion",
    "addressLocality",
    "streetAddress",
    "certificationSystem",
  ],
} as const satisfies JSONSchema;

export const JapaneseExistenceCertificate = {
  allOf: [
    OpVc,
    {
      type: "object",
      properties: {
        "@context": OpCipContext,
        type: {
          type: "array",
          additionalItems: false,
          minItems: 1,
          items: [{ const: "VerifiableCredential" }, { const: "Certificate" }],
        },
        issuer: { type: "string", format: "uri" },
        credentialSubject: JapaneseExistenceCertificateProperties,
        validFrom: {
          type: "string",
          title: "有効開始日時",
          description:
            "http://www.w3.org/2001/XMLSchema#dateTime 形式の有効開始日時",
        },
        validUntil: {
          type: "string",
          title: "有効終了日時",
          description:
            "http://www.w3.org/2001/XMLSchema#dateTime 形式の有効終了日時",
        },
      },
      required: ["@context", "type", "issuer", "credentialSubject"],
    },
  ],
} as const satisfies JSONSchema;

export type JapaneseExistenceCertificate = FromSchema<
  typeof JapaneseExistenceCertificate
>;
