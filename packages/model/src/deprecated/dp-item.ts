import { FromSchema, JSONSchema } from "json-schema-to-ts";
import Advertisement from "./advertisement";
import DpHtml from "./dp-html";
import DpText from "./dp-text";
import DpVisibleText from "./dp-visible-text";
import OgWebsite from "./og-website";

/** @deprecated */
const DpItem = {
  title: "Document Profile Item",
  anyOf: [DpVisibleText, DpText, DpHtml, OgWebsite, Advertisement],
} as const satisfies JSONSchema;

/** @deprecated */
type DpItem = FromSchema<typeof DpItem>;

export default DpItem;
