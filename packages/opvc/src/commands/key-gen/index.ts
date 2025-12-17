import { Command, Flags } from "@oclif/core";
import { generateKey } from "@originator-profile/cryptography";
import fs from "node:fs/promises";

export class KeyGen extends Command {
  static description = "鍵ペアの生成";
  static flags = {
    output: Flags.string({
      char: "o",
      description:
        "鍵を保存するファイル名（拡張子除く）。<output>.priv.json と <output>.pub.json を出力します。",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KeyGen);
    const { publicKey, privateKey } = await generateKey();
    const privateKeyFilename = `${flags.output}.priv.json`;
    const publicKeyFilename = `${flags.output}.pub.json`;
    await fs.writeFile(publicKeyFilename, JSON.stringify(publicKey, null, 2));
    await fs.writeFile(privateKeyFilename, JSON.stringify(privateKey, null, 2));
  }
}
