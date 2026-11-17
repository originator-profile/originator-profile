import { Args, Command } from "@oclif/core";
import { check, config as configFlag } from "../cli/flags.ts";
import { injectReportLines } from "../cli/format.ts";
import { loadCaConfig } from "../operations/config.ts";
import { inject } from "../operations/inject.ts";

export default class Inject extends Command {
  static summary = "HTML に CAS のタグを入れる";
  static description = `\
ビルド済み HTML に CAS の <script> を足し、外部リソースの integrity を揃える。
--check では書き込まず、足りないタグと古い integrity だけを出す。`;

  static flags = {
    config: configFlag,
    check,
  };

  static args = {
    paths: Args.string({
      description:
        "ビルド済み HTML 配下のファイル、ディレクトリ、glob。省略時は全体。",
      required: false,
      multiple: true,
    }),
  };

  static examples = [
    "$ <%= config.bin %> inject",
    "$ <%= config.bin %> inject docs --check",
  ];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(Inject);
    const config = await loadCaConfig(flags.config);
    const report = await inject(config, {
      check: flags.check,
      paths: args.paths ?? [],
    });
    for (const line of injectReportLines(report, {
      check: flags.check,
      mode: config.cas.mode,
    })) {
      this.log(line);
    }
  }
}
