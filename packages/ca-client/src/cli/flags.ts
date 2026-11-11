import { Flags } from "@oclif/core";

export const config = Flags.string({
  summary: "設定ファイル",
  description: "既定は ca.config.json",
  default: "ca.config.json",
});

export const issuer = Flags.string({
  summary: "発行者 ID",
  description: "dns: で始まる OP ID",
});

export const within = Flags.custom<number>({
  summary: "期限までの日数",
  description: "既定は config の renewWithinDays（30）",
  async parse(input: string): Promise<number> {
    const parsed = Number(input);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`--within は 0 以上の数: ${input}`);
    }
    return parsed;
  },
});

export const check = Flags.boolean({
  summary: "書き込まずに照合だけする",
  default: false,
});
