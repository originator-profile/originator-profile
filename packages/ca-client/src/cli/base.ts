import { Command, Errors } from "@oclif/core";
import { loadConfig as loadCaConfig, type CaConfig } from "../site/config";
import { config } from "./flags";
import { notifyScriptFailure } from "./notify";

export abstract class BaseCommand extends Command {
  static override baseFlags = {
    config,
  };

  protected loadConfig(file: string): Promise<CaConfig> {
    return loadCaConfig(file);
  }

  protected stdio(): {
    log: (message?: string) => void;
    error: (message?: string) => void;
  } {
    return {
      log: (message) => {
        if (message !== undefined) {
          this.log(message);
        }
      },
      error: (message) => {
        if (message !== undefined) {
          this.logToStderr(message);
        }
      },
    };
  }

  public override async catch(
    error: Error & { exitCode?: number; oclif?: { exit?: number } },
  ): Promise<unknown> {
    const exitCode =
      error instanceof Errors.ExitError ? error.oclif.exit : error.oclif?.exit;
    if (exitCode !== 0) {
      const command = [this.id, ...this.argv]
        .filter((part) => part !== undefined && part !== "")
        .join(" ");
      await notifyScriptFailure({
        source: `opca ${command}`.trim(),
        error,
      });
    }
    return super.catch(error);
  }
}
