import { FromSchema } from "json-schema-to-ts";
import DpLocation from "./dp-location";
import DpProof from "./dp-proof";
import DpUrl from "./dp-url";

/** @deprecated */
const DpVisibleText = {
  title: "Document Profile Visible Text",
  description:
    "対象の要素のその子孫のレンダリングされたテキストとそのテキストへの署名",
  type: "object",
  properties: {
    type: { const: "visibleText" },
    url: DpUrl,
    location: DpLocation,
    proof: DpProof,
  },
  required: ["type", "proof"],
  additionalProperties: false,
} as const;

/** @deprecated */
type DpVisibleText = FromSchema<typeof DpVisibleText>;

export default DpVisibleText;
