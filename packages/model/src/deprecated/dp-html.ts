import { FromSchema, JSONSchema } from "json-schema-to-ts";
import DpLocation from "./dp-location";
import DpProof from "./dp-proof";
import DpUrl from "./dp-url";

/** @deprecated */
const DpHtml = {
  title: "Document Profile HTML",
  description: "対象の要素とその子孫を含む部分の HTML とその HTML への署名",
  type: "object",
  properties: {
    type: { const: "html" },
    url: DpUrl,
    location: DpLocation,
    proof: DpProof,
  },
  required: ["type", "proof"],
  additionalProperties: false,
} as const satisfies JSONSchema;

/** @deprecated */
type DpHtml = FromSchema<typeof DpHtml>;

export default DpHtml;
