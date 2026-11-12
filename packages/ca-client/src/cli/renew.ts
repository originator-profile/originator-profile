import type { CaClient } from "../ca-client/create-ca-client.ts";
import type { CaConfig } from "./config.ts";
import { isExpiring } from "./expiry.ts";
import { matchFiles, notFound, resolveFiles } from "./paths.ts";
import {
  labelOf,
  loadSource,
  readCas,
  upsertOwnCa,
  type CasContext,
  type CasSource,
} from "./source.ts";

type RenewConfig = CasContext & Pick<CaConfig, "distDir" | "renewWithinDays">;

const fileSource = (path: string): CasSource => ({ kind: "file", path });

const pageSources = async (
  htmlFiles: string[],
  config: RenewConfig,
  kinds: CasSource["kind"][],
): Promise<CasSource[]> => {
  const sources: CasSource[] = [];
  for (const htmlFile of htmlFiles) {
    const source = await loadSource(htmlFile, config);
    if (source !== undefined && kinds.includes(source.kind)) {
      sources.push(source);
    }
  }
  return sources;
};

const collect = async (
  config: RenewConfig,
  paths: string[],
): Promise<CasSource[]> => {
  if (paths.length === 0) {
    return [
      ...(await resolveFiles(config.publicDir, [], ".cas.json")).map(
        fileSource,
      ),
      ...(await pageSources(
        await resolveFiles(config.distDir, [], ".html"),
        config,
        ["inline"],
      )),
    ];
  }
  const sources = new Map<string, CasSource>();
  const add = (source: CasSource) =>
    sources.set(source.kind === "file" ? source.path : source.htmlFile, source);
  for (const path of paths) {
    const casFiles = await matchFiles(config.publicDir, path, ".cas.json");
    const htmlFiles =
      casFiles.length > 0
        ? []
        : await matchFiles(config.distDir, path, ".html");
    if (casFiles.length === 0 && htmlFiles.length === 0) {
      throw notFound(path, [config.publicDir, config.distDir]);
    }
    casFiles.map(fileSource).forEach(add);
    (await pageSources(htmlFiles, config, ["file", "inline"])).forEach(add);
  }
  return [...sources.values()];
};

export const renew = async (
  config: RenewConfig,
  options: {
    signer: Pick<CaClient, "reSign">;
    log: Pick<Console, "log">;
    paths?: string[];
    withinDays?: number;
    all?: boolean;
  },
): Promise<string[]> => {
  const withinDays = options.withinDays ?? config.renewWithinDays;
  const sources = await collect(config, options.paths ?? []);
  const renewed: string[] = [];
  for (const source of sources) {
    const label = labelOf(source);
    try {
      const cas = await readCas(source, config.issuer);
      if (
        cas === undefined ||
        (!options.all && !isExpiring(cas.expiresAt, withinDays))
      ) {
        continue;
      }
      await upsertOwnCa(
        source,
        await options.signer.reSign(cas.payload, label),
        config,
      );
    } catch (error) {
      throw new Error(`renew ${label}`, { cause: error });
    }
    renewed.push(label);
    options.log.log(`✓ Renewed ${label}`);
  }
  options.log.log(
    `Renewed ${renewed.length} of ${sources.length} CAS (${options.all ? "all" : `expiring within ${withinDays} days`})`,
  );
  return renewed;
};
