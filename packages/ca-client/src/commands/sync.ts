import { Command } from "@oclif/core";
import { caClientFromEnv } from "../cli/client.ts";
import { check, CONFIG_FILE } from "../cli/flags.ts";
import { issuedLine, scanLines, syncResultLines } from "../cli/format.ts";
import { loadCaConfig } from "../operations/config.ts";
import { sync } from "../operations/sync.ts";

export default class Sync extends Command {
  static summary =
    "ページの HTML と既存の CA を調べて、ずれているものを署名する";
  static description = `\
ビルド済み HTML と CA を調べて、ずれているものを署名する。
状態は次のとおり。
- ok: 問題なし
- missing: CA が存在しない
- drifted: CA があるが、本文・メタ情報などが HTML と一致しない
- orphan: どのページからも参照されていない
- stale-copy: publicDir と distDir のコピーが揃っていない
--check では書き込まずに結果だけを出す。`;

  static flags = {
    check,
  };

  static examples = [
    "$ <%= config.bin %> sync",
    "$ <%= config.bin %> sync --check",
  ];

  async run(): Promise<void> {
    const { flags } = await this.parse(Sync);
    const config = await loadCaConfig(CONFIG_FILE);
    const report = flags.check
      ? await sync(config, {
          check: true,
          onScanned: (scanned) => {
            for (const line of scanLines(scanned, { check: true })) {
              this.log(line);
            }
          },
        })
      : await sync(config, {
          check: false,
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
  }
}
