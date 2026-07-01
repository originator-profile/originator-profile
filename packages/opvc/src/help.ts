import { CommandHelp, Help as OclifHelp } from "@oclif/core/help";
import wrapAnsi from "wrap-ansi";

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

export default class Help extends OclifHelp {
  CommandHelpClass = IndentPreservingCommandHelp;
}
