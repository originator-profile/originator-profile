import { Args, Command, Flags } from "@oclif/core";
import { writeFile } from "node:fs/promises";
import { config as configFlag } from "../cli/flags.ts";
import { labelOf } from "../cli/format.ts";
import { loadCaConfig } from "../operations/config.ts";
import { unsignedCaFromPage } from "../operations/unsigned-page.ts";

export default class Json extends Command {
  static summary = "ページから未署名 CA の JSON を作る";
  static description = `\
HTML ページから未署名の Content Attestation を組み立て、JSON として出す。
--out を省略すると標準出力に書く。`;

  static flags = {
    config: configFlag,
    selector: Flags.string({
      summary: "証明する要素の CSS セレクタ",
      description: "省略時は設定の selectors を使う。",
    }),
    out: Flags.string({
      summary: "JSON を書くパス",
    }),
  };

  static args = {
    page: Args.string({
      description: "対象の HTML ファイル",
      required: true,
    }),
  };

  static examples = [
    "$ <%= config.bin %> json dist/news/a/index.html",
    "$ <%= config.bin %> json dist/news/a/index.html --out unsigned.json",
  ];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(Json);
    const config = await loadCaConfig(flags.config);
    const { uca, cas } = await unsignedCaFromPage(config, args.page, {
      selector: flags.selector,
    });
    const json = `${JSON.stringify(uca, null, 2)}\n`;
    if (flags.out) {
      await writeFile(flags.out, json);
    } else {
      process.stdout.write(json);
    }
    this.warn(
      cas ? `署名先: ${labelOf(cas)}` : "CAS の <script> がページにありません",
    );
  }
}
