import { FromSchema } from "json-schema-to-ts";
import DpAllowedOrigins from "./dp-allowed-origins";
import DpItem from "./dp-item";

/** @deprecated */
const Dp = {
  title: "Document Profile",
  type: "object",
  properties: {
    type: { const: "dp" },
    issuer: {
      title: "Issuer",
      description: "組織を表す一義的な識別子",
      type: "string",
    },
    subject: {
      title: "Subject",
      description: "出版物を表す一義的な識別子",
      type: "string",
    },
    issuedAt: {
      title: "発行日時",
      type: "string",
      format: "date-time",
    },
    expiredAt: {
      title: "期限切れ日時",
      type: "string",
      format: "date-time",
    },
    item: {
      title: DpItem.title,
      type: "array",
      items: DpItem,
    },
    allowedOrigins: DpAllowedOrigins,
  },
  required: ["type", "issuer", "subject", "issuedAt", "expiredAt", "item"],
  additionalProperties: false,
} as const;

/** @deprecated */
type Dp = FromSchema<typeof Dp>;

export default Dp;
