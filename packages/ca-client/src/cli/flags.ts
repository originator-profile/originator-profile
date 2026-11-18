import { Flags } from "@oclif/core";

/** CLI が読む設定ファイル。常に cwd 基準のこの名前。 */
export const CONFIG_FILE = "ca.config.json";

export const check = Flags.boolean({
  summary: "書き込まずに結果だけを出す",
  default: false,
});

export const issuer = Flags.string({
  summary: "発行者 ID（dns: で始まる）",
  description: "例: dns:example.com。設定の issuer を上書きする。",
});

export const all = Flags.boolean({
  summary: "期限に関わらず再署名する",
  default: false,
});
