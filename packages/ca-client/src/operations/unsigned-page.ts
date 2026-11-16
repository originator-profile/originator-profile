import type { UnsignedContentAttestation } from "@originator-profile/model";
import { relative, resolve } from "node:path";
import {
  locationOf,
  ownCaSourceOf,
  readRecorded,
  type CasLocation,
} from "../cas/source.ts";
import { readText } from "../utils/file.ts";
import { parseHtml } from "../utils/html.ts";
import type { CaConfig } from "./config.ts";
import { buildUnsignedCa, pathnameOf } from "./page.ts";

export type UnsignedPage = {
  uca: UnsignedContentAttestation;
  cas: CasLocation | undefined;
};

/** HTML ファイルから未署名 CA を組み立てる。 */
export const unsignedCaFromPage = async (
  config: CaConfig,
  page: string,
  options: { selector?: string } = {},
): Promise<UnsignedPage> => {
  const htmlFile = resolve(page);
  const html = await readText(htmlFile);
  const dom = parseHtml(html);
  try {
    const source = await ownCaSourceOf(dom, config, htmlFile, html);
    const uca = buildUnsignedCa({
      config,
      document: dom.window.document,
      pathname: pathnameOf(config.distDir, htmlFile),
      recorded: await readRecorded(source, config.issuer),
      selector: options.selector,
      content: relative(process.cwd(), htmlFile),
    });
    return { uca, cas: source && locationOf(source) };
  } finally {
    dom.window.close();
  }
};
