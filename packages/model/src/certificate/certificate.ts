import { FromSchema, JSONSchema } from "json-schema-to-ts";
import { OpCipContext } from "../context/op-cip-context";
import { OpVc } from "../op-vc";
import { CertificateProperties } from "./certificate-properties";

export const Certificate = {
  type: "object",
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
        credentialSubject: CertificateProperties,
      },
      required: ["@context", "type", "issuer", "credentialSubject"],
    },
  ],
} as const satisfies JSONSchema;

export type Certificate = FromSchema<typeof Certificate>;
