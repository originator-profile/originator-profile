import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { labelOf, ownCaSourceOf, parseHtml, readRecorded } from "../cas/source";
import type { CaConfig } from "../site/config";
import { buildUnsignedCa, pathnameOf } from "../site/page";

export const json = async (input: {
  config: CaConfig;
  page: string;
  selector?: string;
}): Promise<{ json: string; message: string }> => {
  const htmlFile = resolve(input.page);
  const html = await readFile(htmlFile, "utf-8");
  const dom = parseHtml(html);
  try {
    const source = await ownCaSourceOf(dom, input.config, htmlFile, html);
    const uca = buildUnsignedCa({
      config: input.config,
      document: dom.window.document,
      pathname: pathnameOf(input.config.distDir, htmlFile),
      recorded: await readRecorded(source, input.config.issuer),
      selector: input.selector,
      content: relative(process.cwd(), htmlFile),
    });
    return {
      json: `${JSON.stringify(uca, null, 2)}\n`,
      message: source
        ? `署名先: ${labelOf(source)}`
        : "CAS の <script> がページにありません",
    };
  } finally {
    dom.window.close();
  }
};
