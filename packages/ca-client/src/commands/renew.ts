import { Command } from "@oclif/core";
import { caClientFromEnv } from "../cli/client.ts";
import { all, CONFIG_FILE } from "../cli/flags.ts";
import { renewReportLine, renewedLine } from "../cli/format.ts";
import { loadCaConfig } from "../operations/config.ts";
import { renew } from "../operations/renew.ts";

export default class Renew extends Command {
  static summary = "期限切れの CA を再署名する";
  static description = `\
既存の CAS を再署名する。
既定では期限切れ（または exp の無いもの）だけを対象にする。
期限前にまとめて更新したいときは --all を定期実行する。`;

  static flags = {
    all,
  };

  static examples = [
    "$ <%= config.bin %> renew",
    "$ <%= config.bin %> renew --all",
  ];

  async run(): Promise<void> {
    const { flags } = await this.parse(Renew);
    const config = await loadCaConfig(CONFIG_FILE);
    const report = await renew(config, {
      signer: caClientFromEnv(config.issuer),
      all: flags.all,
      onRenewed: (cas) => {
        this.log(renewedLine(cas));
      },
    });
    this.log(renewReportLine(report));
  }
}
