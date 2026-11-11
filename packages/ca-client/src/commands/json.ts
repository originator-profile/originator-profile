import { Args, Flags } from "@oclif/core";
import { writeFile } from "node:fs/promises";
import { BaseCommand } from "../cli/base";
import { json as jsonPage } from "../operations/json";

export class Json extends BaseCommand {
  static override summary = "HTML 1 ページから未署名 CA の JSON を作る";
  static override usage = "json <page.html> [--selector <css>] [--out <file>]";
  static override args = {
    page: Args.string({
      description: "ビルド済み HTML",
      required: true,
    }),
  };
  static override flags = {
    selector: Flags.string({ summary: "証明する要素の CSS selector" }),
    out: Flags.string({ summary: "未署名 CA を書き出す JSON ファイル" }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Json);
    const { json, message } = await jsonPage({
      config: await this.loadConfig(flags.config),
      page: args.page,
      selector: flags.selector,
    });
    if (flags.out) {
      await writeFile(flags.out, json);
    } else {
      process.stdout.write(json);
    }
    this.logToStderr(message);
  }
}
