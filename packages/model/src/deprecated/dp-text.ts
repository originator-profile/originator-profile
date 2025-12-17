import { FromSchema } from "json-schema-to-ts";
import DpLocation from "./dp-location";
import DpProof from "./dp-proof";
import DpUrl from "./dp-url";

/** @deprecated */
const DpText = {
  title: "Document Profile Text",
  description: "対象の要素の子孫のテキストとそのテキストへの署名",
  type: "object",
  properties: {
    type: { const: "text" },
    url: DpUrl,
    location: DpLocation,
    proof: DpProof,
  },
  required: ["type", "proof"],
  additionalProperties: false,
} as const;

/** @deprecated */
type DpText = FromSchema<typeof DpText>;

export default DpText;
