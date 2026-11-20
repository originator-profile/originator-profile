import { Command } from "@oclif/core";
import { check, CONFIG_FILE } from "../cli/flags.ts";
import { injectReportLines } from "../cli/format.ts";
import { loadCaConfig } from "../operations/config.ts";
import { inject } from "../operations/inject.ts";

export default class Inject extends Command {
  static summary = "HTML に CAS のタグを入れる";
  static description = `\
ビルド済み HTML に CAS の <script> を挿入し、画像などの外部リソースの integrity を追加・更新する。
--check では書き込まずに結果だけを出す。`;

  static flags = {
    check,
  };

  static examples = [
    "$ <%= config.bin %> inject",
    "$ <%= config.bin %> inject --check",
  ];

  async run(): Promise<void> {
    const { flags } = await this.parse(Inject);
    const config = await loadCaConfig(CONFIG_FILE);
    const report = await inject(config, { check: flags.check });
    for (const line of injectReportLines(report, { check: flags.check })) {
      this.log(line);
    }
  }
}
