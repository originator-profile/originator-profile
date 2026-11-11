import { Flags } from "@oclif/core";
import { resolve } from "node:path";
import { withTerminalAsk } from "../cli/ask";
import { BaseCommand } from "../cli/base";
import { issuer } from "../cli/flags";
import { init, parsePersistence } from "../operations/init";

export class Init extends BaseCommand {
  static override summary = "ビルド済み HTML を調べて ca.config.json を作る";
  static override usage =
    "init [--issuer <dns:...>] [--dist <dir>] [--origin <url>...] [--selector <css>] [--author <name>...] [--editor <name>...] [--genre <genre>] [--exclude <regexp>...] [--persistence commit|rebuild] [--public <dir>] [--force]";
  static override flags = {
    issuer,
    dist: Flags.string({ summary: "ビルド済み HTML のディレクトリ" }),
    origin: Flags.string({
      summary: "サイトのオリジン",
      multiple: true,
    }),
    selector: Flags.string({ summary: "証明する要素の CSS selector" }),
    author: Flags.string({ summary: "著者", multiple: true }),
    editor: Flags.string({ summary: "編集者", multiple: true }),
    genre: Flags.string({ summary: "ジャンル" }),
    exclude: Flags.string({
      summary: "対象にしないパスの正規表現",
      multiple: true,
    }),
    persistence: Flags.string({
      summary: "CAS の置き場所（commit か rebuild）",
    }),
    public: Flags.string({ summary: "CAS を置く静的ファイルのディレクトリ" }),
    force: Flags.boolean({
      summary: "違う内容の設定ファイルを上書きする",
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    const options = {
      configFile: flags.config,
      answers: {
        issuer: flags.issuer,
        distDir: flags.dist,
        publicDir: flags.public ? resolve(flags.public) : undefined,
        origins: flags.origin,
        selector: flags.selector,
        author: flags.author,
        editor: flags.editor,
        genre: flags.genre,
        exclude: flags.exclude,
        persistence:
          flags.persistence === undefined
            ? undefined
            : parsePersistence(flags.persistence),
      },
      force: flags.force,
      log: this.stdio(),
    };
    if (process.stdin.isTTY) {
      await withTerminalAsk((ask) => init({ ...options, ask }));
      return;
    }
    await init(options);
  }
}
