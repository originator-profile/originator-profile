import { FromSchema, JSONSchema } from "json-schema-to-ts";
import { Image } from "./image";
import { OpVc } from "./op-vc";

const subject = {
  type: "object",
  additionalProperties: true,
  properties: {
    id: { title: "WMP 保有組織の OP ID", type: "string", format: "uri" },
    type: { const: "OnlineBusiness" },
    url: { title: "Web メディア URL", type: "string", format: "uri" },
    name: { title: "Web メディア名", type: "string" },
    logo: Image,
    email: { title: "メールアドレス", type: "string", format: "email" },
    telephone: { title: "電話番号", type: "string" },
    contactPoint: {
      type: "object",
      properties: {
        id: { title: "連絡先ページ URL", type: "string", format: "uri" },
        name: { title: "連絡先ページ表示名", type: "string" },
      },
      required: ["id", "name"],
    },
    informationTransmissionPolicy: {
      type: "object",
      properties: {
        id: { title: "情報発信ポリシー URL", type: "string", format: "uri" },
        name: { title: "情報発信ポリシー表示名", type: "string" },
      },
      required: ["id", "name"],
    },
    publishingPrinciple: {
      type: "object",
      properties: {
        id: { title: "編集ガイドライン URL", type: "string", format: "uri" },
        name: { title: "編集ガイドライン表示名", type: "string" },
      },
      required: ["id", "name"],
    },
    privacyPolicy: {
      type: "object",
      properties: {
        id: {
          title: "プライバシーポリシーページ URL",
          type: "string",
          format: "uri",
        },
        name: { title: "プライバシーポリシーページ表示名", type: "string" },
      },
      required: ["id", "name"],
    },
    description: { title: "組織に関する説明", type: "string" },
  },
  required: ["id", "type", "url", "name"],
} as const satisfies JSONSchema;

export const WebMediaProfile = {
  title: "Web Media Profile",
  type: "object",
  additionalProperties: true,
  allOf: [
    OpVc,
    {
      type: "object",
      properties: {
        type: {
          type: "array",
          minItems: 2,
          items: [
            { const: "VerifiableCredential" },
            { const: "WebMediaProfile" },
          ],
          additionalItems: false,
        },
        credentialSubject: subject,
      },
      required: ["type", "credentialSubject"],
    },
  ],
  required: ["type", "credentialSubject"],
} as const satisfies JSONSchema;

export type WebMediaProfile = FromSchema<typeof WebMediaProfile>;
