import { Args, Command, Flags } from "@oclif/core";
import { writeFile } from "node:fs/promises";
import { caClientFromEnv } from "../cli/client.ts";
import { check, config as configFlag } from "../cli/flags.ts";
import { issuedLine, scanLines, syncResultLines } from "../cli/format.ts";
import { loadCaConfig } from "../operations/config.ts";
import { sync } from "../operations/sync.ts";

export default class Sync extends Command {
  static summary = "ページの CA を照合し、必要なら署名する";
  static description = `\
ビルド済み HTML を調べ、欠けている・内容がずれた・期限が近い CA を署名する。
状態は ok / missing / drifted / expiring。orphan は参照の無い CAS、stale-copy はコピーが揃っていないもの。
--check では書き込まず照合だけする。欠けやずれがあっても終了コードは 0。CA を作れないページがあると失敗する。
署名には環境変数 CA_SERVER_URL と CCSP_CONFIG が必要。`;

  static flags = {
    config: configFlag,
    check,
    report: Flags.string({
      summary: "照合結果を書く JSON ファイル",
    }),
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
