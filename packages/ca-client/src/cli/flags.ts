import { Flags } from "@oclif/core";
import { parsePersistence } from "../operations/site-init.ts";

export const config = Flags.string({
  summary: "設定ファイルのパス",
  description: "既定は ca.config.json。",
  default: "ca.config.json",
});

export const check = Flags.boolean({
  summary: "書き込まずに結果だけを出す",
  default: false,
});

export const issuer = Flags.string({
  summary: "発行者 ID",
  description: "例: dns:example.com。sign で設定ファイルが無いときに必要。",
});

export const within = Flags.integer({
  summary: "再署名する期限までの日数",
  description: "省略時は設定の renewWithinDays（既定 30）。0 以上。",
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

export const persistence = Flags.custom<ReturnType<typeof parsePersistence>>({
  summary: "CAS の置き方",
  description:
    "commit はリポジトリに置く。rebuild はデプロイのたびに作り直す。",
  options: ["commit", "rebuild"],
  parse: async (input) => parsePersistence(input),
})();
