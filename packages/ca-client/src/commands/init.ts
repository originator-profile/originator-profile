import { Command, Flags } from "@oclif/core";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  config as configFlag,
  force,
  issuer,
  persistence,
} from "../cli/flags.ts";
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
  static summary = "ca.config.json を作る";
  static description = `\
ビルド済み HTML を調べ、ca.config.json の草案を書く。
端末では渡していない項目を、推定した値を既定にして聞く。`;

  static flags = {
    config: configFlag,
    issuer,
    dist: Flags.string({
      summary: "ビルド済み HTML のディレクトリ",
    }),
    public: Flags.string({
      summary: "CAS を置く静的ファイルのディレクトリ",
    }),
    origin: Flags.string({
      summary: "サイトのオリジン",
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
    exclude: Flags.string({
      summary: "対象にしないパスの正規表現",
      multiple: true,
    }),
    persistence,
    force,
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
      persistence: flags.persistence,
    };
    const options = {
      configFile: flags.config,
      answers,
      force: flags.force,
      log: this,
    };
    await (process.stdin.isTTY
      ? withTerminalAsk((ask) => init({ ...options, ask }))
      : init(options));
  }
}
