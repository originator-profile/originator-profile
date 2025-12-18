import { FromSchema, JSONSchema } from "json-schema-to-ts";
import { CpContext } from "./context/cp-context";
import { Jwks } from "./jwks";
import { OpVc } from "./op-vc";

export const CoreProfile = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...OpVc.properties,
    "@context": CpContext,
    type: {
      type: "array",
      additionalItems: false,
      minItems: 2,
      items: [{ const: "VerifiableCredential" }, { const: "CoreProfile" }],
    },
    issuer: { type: "string" },
    credentialSubject: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string", format: "uri" },
        type: {
          const: "Core",
        },
        jwks: {
          ...Jwks,
          title: "保有組織の公開鍵の JSON Web Key Set",
        },
      },
      required: ["id", "type", "jwks"],
    },
  },
  required: ["@context", "type", "issuer", "credentialSubject"],
} as const satisfies JSONSchema;

export type CoreProfile = FromSchema<typeof CoreProfile>;
