import { Command, Flags } from "@oclif/core";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { CONFIG_FILE, issuer } from "../cli/flags.ts";
import { init, type Ask, type InitAnswers } from "../cli/init.ts";

const withTerminalAsk = async <T>(run: (ask: Ask) => Promise<T>) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await run(async (question, fallback) => {
      const answer = (
        await rl.question(`${question}${fallback ? ` [${fallback}]` : ""}: `)
      ).trim();
      return answer || fallback || "";
    });
  } finally {
    rl.close();
  }
};

export default class Init extends Command {
  static summary = "初期設定を作る";
  static description = `\
CA / CAS を管理する CLI の初期設定（${CONFIG_FILE}）を作る。
ビルド済み HTML から候補を出し、未指定の項目は対話で確認する。`;

  static flags = {
    issuer,
    origin: Flags.string({
      summary: "サイトの URL（例: https://example.com）",
      multiple: true,
    }),
    selector: Flags.string({
      summary: "証明する要素の CSS セレクタ",
    }),
    author: Flags.string({
      summary: "author が無いページの既定の著者",
      multiple: true,
    }),
    editor: Flags.string({
      summary: "既定の編集者",
      multiple: true,
    }),
    genre: Flags.string({
      summary: "article:section が無いページの既定ジャンル",
    }),
    dist: Flags.string({
      summary: "ビルド済み HTML のディレクトリ",
    }),
    public: Flags.string({
      summary: "CAS を置く静的ファイルのディレクトリ",
    }),
    exclude: Flags.string({
      summary: "対象にしないパスの正規表現",
      multiple: true,
    }),
  };

  static examples = [
    "$ <%= config.bin %> init",
    "$ <%= config.bin %> init --issuer dns:example.com --dist dist",
  ];

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    const answers: InitAnswers = {
      issuer: flags.issuer,
      distDir: flags.dist,
      publicDir: flags.public ? resolve(flags.public) : undefined,
      origins: flags.origin,
      selector: flags.selector,
      author: flags.author,
      editor: flags.editor,
      genre: flags.genre,
      exclude: flags.exclude,
    };
    const options = {
      configFile: CONFIG_FILE,
      answers,
      log: this,
    };
    await (process.stdin.isTTY
      ? withTerminalAsk((ask) => init({ ...options, ask }))
      : init(options));
  }
}
