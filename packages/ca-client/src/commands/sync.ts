import { Args, Command, Flags } from "@oclif/core";
import { writeFile } from "node:fs/promises";
import { caClientFromEnv } from "../cli/client.ts";
import { check, config as configFlag } from "../cli/flags.ts";
import { issuedLine, scanLines, syncResultLines } from "../cli/format.ts";
import { loadCaConfig } from "../operations/config.ts";
import { sync } from "../operations/sync.ts";

export default class Sync extends Command {
  static summary = "ページの CA を照合・発行する";
  static description = `\
ビルド済み HTML を走査し、欠けている・ずれた・期限が近い CA を署名する。
--check を付けると書き込まず、照合結果だけを出す。`;

  static flags = {
    config: configFlag,
    check,
    report: Flags.string({
      summary: "照合結果を書く JSON ファイル",
    }),
  };

  static args = {
    paths: Args.string({
      description: "distDir 配下の HTML、ディレクトリ、glob。省略時は全体。",
      required: false,
      multiple: true,
    }),
  };

  static examples = [
    "$ <%= config.bin %> sync",
    "$ <%= config.bin %> sync docs --check",
    "$ <%= config.bin %> sync docs/news --report report.json",
  ];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(Sync);
    const config = await loadCaConfig(flags.config);
    const paths = args.paths ?? [];
    const report = flags.check
      ? await sync(config, {
          check: true,
          paths,
          onScanned: (scanned) => {
            for (const line of scanLines(scanned, { check: true })) {
              this.log(line);
            }
          },
        })
      : await sync(config, {
          check: false,
          paths,
          signer: caClientFromEnv(config.issuer),
          onScanned: (scanned) => {
            for (const line of scanLines(scanned, { check: false })) {
              this.log(line);
            }
          },
          onIssued: (page) => {
            this.log(issuedLine(page));
          },
        });
    for (const line of syncResultLines(report)) {
      this.log(line);
    }
    if (flags.report) {
      await writeFile(flags.report, `${JSON.stringify(report, null, 2)}\n`);
    }
  }
}
