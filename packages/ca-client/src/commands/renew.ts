import { Args, Command } from "@oclif/core";
import { caClientFromEnv } from "../cli/client.ts";
import { all, config as configFlag, within } from "../cli/flags.ts";
import { renewReportLine, renewedLine } from "../cli/format.ts";
import { loadCaConfig } from "../operations/config.ts";
import { renew } from "../operations/renew.ts";

export default class Renew extends Command {
  static summary = "期限が近い CA を再署名する";
  static description = `\
既存の CAS を再署名する。
既定では設定の renewWithinDays 以内に切れるものだけを対象にする。
--all で期限に関わらず再署名する。`;

  static flags = {
    config: configFlag,
    within,
    all,
  };

  static args = {
    paths: Args.string({
      description:
        "distDir 配下の HTML、または publicDir 配下の CAS。省略時は全体。",
      required: false,
      multiple: true,
    }),
  };

  static examples = [
    "$ <%= config.bin %> renew",
    "$ <%= config.bin %> renew --within 7",
    "$ <%= config.bin %> renew --all",
  ];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(Renew);
    const config = await loadCaConfig(flags.config);
    const report = await renew(config, {
      signer: caClientFromEnv(config.issuer),
      paths: args.paths ?? [],
      withinDays: flags.within,
      all: flags.all,
      onRenewed: (cas) => {
        this.log(renewedLine(cas));
      },
    });
    this.log(renewReportLine(report));
  }
}
