import { Command, Flags } from "@oclif/core";
import { caClientFromEnv } from "../cli/client.ts";
import { config as configFlag, issuer } from "../cli/flags.ts";
import { loadCaConfig } from "../operations/config.ts";
import { signCaFile } from "../operations/sign.ts";

export default class Sign extends Command {
  static summary = "未署名 CA の JSON を署名する";
  static description = `\
未署名の Content Attestation JSON を CA サーバーで署名する。
--out を付けると CAS ファイルに書き、省略すると JWT を標準出力に出す。
設定ファイルが無いときは --issuer が必要。`;

  static flags = {
    config: configFlag,
    issuer,
    input: Flags.string({
      summary: "未署名 CA の JSON ファイル",
      required: true,
    }),
    out: Flags.string({
      summary: "署名した CAS を書くパス",
    }),
  };

  static examples = [
    "$ <%= config.bin %> sign --input unsigned.json --out dist/cas/page.cas.json",
    "$ <%= config.bin %> sign --input unsigned.json --issuer dns:example.com",
  ];

  async run(): Promise<void> {
    const { flags } = await this.parse(Sign);
    const loaded = await loadCaConfig(flags.config).catch(() => undefined);
    const jwt = await signCaFile({
      input: flags.input,
      out: flags.out,
      root: process.cwd(),
      signer: caClientFromEnv(flags.issuer ?? loaded?.issuer),
    });
    if (flags.out) {
      this.log(`✓ ${flags.out}`);
    } else {
      this.log(jwt);
    }
  }
}
