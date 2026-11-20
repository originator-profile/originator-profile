import { Command } from "@oclif/core";
import { CommandHelp, Help as OclifHelp } from "@oclif/core/help";
import type { Config, HelpOptions } from "@oclif/core/interfaces";
import wrapAnsi from "wrap-ansi";

// 日本語の FLAG DESCRIPTIONS など、先頭空白を残した折り返しが必要な行がある。
class IndentPreservingCommandHelp extends CommandHelp {
  public wrap(body: string, spacing = this.indentSpacing): string {
    return wrapAnsi(this.render(body), this.opts.maxWidth - spacing, {
      hard: true,
      trim: false,
    })
      .split("\n")
      .map((l) => l.trimEnd())
      .join("\n");
  }
}

const ROOT_ORDER = ["init", "inject", "sync", "renew", "help"];

export default class Help extends OclifHelp {
  CommandHelpClass = IndentPreservingCommandHelp;

  // oclif readme は helpOptions を渡さないので、ここで定義順を既定にする。
  constructor(config: Config, opts: Partial<HelpOptions> = {}) {
    super(config, { ...opts, flagSortOrder: opts.flagSortOrder ?? "none" });
  }

  get sortedCommands(): Command.Loadable[] {
    const rank = new Map(ROOT_ORDER.map((id, index) => [id, index]));
    return super.sortedCommands.sort(
      (a, b) =>
        (rank.get(a.id) ?? ROOT_ORDER.length) -
          (rank.get(b.id) ?? ROOT_ORDER.length) || a.id.localeCompare(b.id),
    );
  }
}
