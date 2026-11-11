import { Flags } from "@oclif/core";
import { BaseCommand } from "../cli/base";
import { clientFromEnv } from "../cli/env";
import { within } from "../cli/flags";
import { renew as renewPages } from "../operations/renew";

export class Renew extends BaseCommand {
  static override summary = "期限が近い CAS を再署名する";
  static override usage = "[paths...] [--within <days>] [--all]";
  static override strict = false;
  static override flags = {
    within: within(),
    all: Flags.boolean({
      summary: "期限に関係なく全件を再署名する",
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { argv, flags } = await this.parse(Renew);
    const config = await this.loadConfig(flags.config);
    await renewPages(config, {
      signer: clientFromEnv(config.issuer),
      log: this.stdio(),
      paths: argv.map((arg) => String(arg)),
      withinDays: flags.within,
      all: flags.all,
    });
  }
}
