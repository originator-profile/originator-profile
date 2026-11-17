import { Flags } from "@oclif/core";
import { parseCasMode } from "../operations/site-init.ts";

export const config = Flags.string({
  summary: "設定ファイルのパス",
  default: "ca.config.json",
});

export const check = Flags.boolean({
  summary: "書き込まずに結果だけを出す",
  default: false,
});

export const issuer = Flags.string({
  summary: "発行者 ID（dns: で始まる）",
  description: "例: dns:example.com。設定の issuer を上書きする。",
});

export const within = Flags.integer({
  summary: "再署名する期限までの日数",
  description: "省略時は設定の再署名期限（既定 30 日）。0 以上。",
  min: 0,
});

export const all = Flags.boolean({
  summary: "期限に関わらず再署名する",
  default: false,
});

export const force = Flags.boolean({
  summary: "既存の設定ファイルを上書きする",
  default: false,
});

export const mode = Flags.custom<ReturnType<typeof parseCasMode>>({
  summary: "CAS の mode",
  description: "file は別ファイルとして置く。inline は HTML に埋め込む。",
  options: ["file", "inline"],
  parse: async (input) => parseCasMode(input),
})();
