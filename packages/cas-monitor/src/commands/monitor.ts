import { Command, Flags } from "@oclif/core";
import { serializeIfError } from "@originator-profile/core";
import { parseInput } from "../cli/parser.js";
import { CasMonitorVerificationResult } from "../types.js";
import { runVerificationPipeline } from "../verify/fetch-and-verify-all.js";

function formatResult(result: CasMonitorVerificationResult, logAll: boolean) {
  const output: Record<string, unknown> = {};

  for (const key of Object.keys(
    result,
  ) as (keyof CasMonitorVerificationResult)[]) {
    const value = result[key];

    //エラーなら常に詳細を表示
    if (value instanceof Error) {
      output[key] = serializeIfError(value);
      continue;
    }

    // null はそのまま表示
    if (value === null) {
      output[key] = null;
      continue;
    }

    // 成功時の挙動
    if (logAll) {
      output[key] = value;
    } else {
      output[key] = "OK";
    }
  }

  return output;
}

export default class Monitor extends Command {
  static summary = "URL から CAS の検証を行う";
  static description = `\
指定した URL について
SP/OPS/CAS の検証を行います。`;
  static flags = {
    input: Flags.string({
      summary: "入力ファイルのパス (JSON 形式)",
      helpValue: "<filepath>",
      required: true,
    }),
    logAll: Flags.boolean({
      summary: "すべての検証結果を表示する",
      default: false,
    }),
  };
  async run(): Promise<void> {
    const { flags } = await this.parse(Monitor);

    const input = await parseInput(flags.input);

    for (const url of input.urls) {
      // oxlint-disable no-await-in-loop
      const result = await runVerificationPipeline(url);
      const output = formatResult(result, flags.logAll);
      this.log(JSON.stringify({ url, ...output }, null, 2));
    }
  }
}
