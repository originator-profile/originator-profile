import { BaseCommand } from "../cli/base";
import { check } from "../cli/flags";
import { inject as injectPages } from "../operations/inject";

export class Inject extends BaseCommand {
  static override summary =
    "CAS の script タグと integrity をビルド済み HTML に入れる";
  static override usage = "inject [paths...] [--check]";
  static override strict = false;
  static override flags = {
    check,
  };

  public async run(): Promise<void> {
    const { argv, flags } = await this.parse(Inject);
    await injectPages(await this.loadConfig(flags.config), {
      check: flags.check,
      paths: argv.map((arg) => String(arg)),
      log: this.stdio(),
    });
  }
}
