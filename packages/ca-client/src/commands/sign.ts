import { Flags } from "@oclif/core";
import { BaseCommand } from "../cli/base";
import { clientFromEnv } from "../cli/env";
import { issuer } from "../cli/flags";
import { signCaFile } from "../operations/sign";

export class Sign extends BaseCommand {
  static override summary = "未署名 CA の JSON を署名する";
  static override usage =
    "sign --input <unsigned-ca.json> [--out <cas.json>] [--issuer <dns:...>]";
  static override flags = {
    input: Flags.string({
      summary: "未署名 CA の JSON",
      required: true,
    }),
    out: Flags.string({ summary: "署名した CAS を書き出すファイル" }),
    issuer,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Sign);
    const configured = await this.loadConfig(flags.config).catch(
      () => undefined,
    );
    const jwt = await signCaFile({
      input: flags.input,
      out: flags.out,
      signer: clientFromEnv(flags.issuer ?? configured?.issuer),
      root: process.cwd(),
    });
    if (flags.out) {
      this.logToStderr(`✓ ${flags.out}`);
      return;
    }
    process.stdout.write(`${jwt}\n`);
  }
}
