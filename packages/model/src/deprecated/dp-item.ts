import { z } from "zod";
import Advertisement from "./advertisement";
import DpHtml from "./dp-html";
import DpText from "./dp-text";
import DpVisibleText from "./dp-visible-text";
import OgWebsite from "./og-website";

/** @deprecated */
const DpItem = z.union([
  DpVisibleText,
  DpText,
  DpHtml,
  OgWebsite,
  Advertisement,
]);

/** @deprecated */
type DpItem = z.infer<typeof DpItem>;

export default DpItem;
