import { Flags } from "@oclif/core";
import { writeFile } from "node:fs/promises";
import { BaseCommand } from "../cli/base";
import { clientFromEnv } from "../cli/env";
import { check } from "../cli/flags";
import { sync as syncPages } from "../operations/sync";

export class Sync extends BaseCommand {
  static override summary =
    "HTML と CAS を照合し、無いページとずれたページを署名する";
  static override usage = "[paths...] [--check] [--report <file>]";
  static override strict = false;
  static override flags = {
    check,
    report: Flags.string({ summary: "照合結果を書き出す JSON ファイル" }),
  };

  public async run(): Promise<void> {
    const { argv, flags } = await this.parse(Sync);
    const config = await this.loadConfig(flags.config);
    const report = await syncPages(config, {
      check: flags.check,
      paths: argv.map((arg) => String(arg)),
      signer: flags.check ? undefined : clientFromEnv(config.issuer),
      log: this.stdio(),
    });
    if (flags.report) {
      await writeFile(flags.report, `${JSON.stringify(report, null, 2)}\n`);
    }
  }
}
