import type { CaClient } from "../ca-client/create-ca-client.ts";
import type { CaConfig } from "./config.ts";
import { isExpiring } from "./expiry.ts";
import { matchFiles, notFound, resolveFiles } from "./paths.ts";
import {
  forEachPage,
  labelOf,
  ownCaSourceOf,
  readCas,
  upsertOwnCa,
  type CasContext,
  type CasSource,
} from "./source.ts";

type RenewConfig = CasContext & Pick<CaConfig, "distDir" | "renewWithinDays">;

type RenewOptions = {
  signer: Pick<CaClient, "reSign">;
  log: Pick<Console, "log">;
  paths?: string[];
  withinDays?: number;
  all?: boolean;
};

const fileSource = (path: string): CasSource => ({ kind: "file", path });

const pageSources = async (
  htmlFiles: string[],
  config: RenewConfig,
): Promise<Map<string, CasSource>> => {
  const sources = new Map<string, CasSource>();
  await forEachPage(htmlFiles, async ({ file, html, dom }) => {
    const source = await ownCaSourceOf(dom, config, file, html);
    if (source !== undefined) {
      sources.set(file, source);
    }
  });
  return sources;
};

const collectAll = async (config: RenewConfig): Promise<CasSource[]> => [
  ...(await resolveFiles(config.publicDir, [], ".cas.json")).map(fileSource),
  ...[
    ...(
      await pageSources(await resolveFiles(config.distDir, [], ".html"), config)
    ).values(),
  ].filter((source) => source.kind === "inline"),
];

const collect = async (
  config: RenewConfig,
  paths: string[],
): Promise<CasSource[]> => {
  if (paths.length === 0) {
    return collectAll(config);
  }
  const matches = await Promise.all(
    paths.map(async (path) => {
      const casFiles = await matchFiles(config.publicDir, path, ".cas.json");
      const htmlFiles =
        casFiles.length > 0
          ? []
          : await matchFiles(config.distDir, path, ".html");
      return { path, casFiles, htmlFiles };
    }),
  );
  const missing = matches.find(
    ({ casFiles, htmlFiles }) =>
      casFiles.length === 0 && htmlFiles.length === 0,
  );
  if (missing !== undefined) {
    throw notFound(missing.path, [config.publicDir, config.distDir]);
  }
  const pages = await pageSources(
    [...new Set(matches.flatMap(({ htmlFiles }) => htmlFiles))],
    config,
  );
  const sources = new Map<string, CasSource>();
  for (const source of matches.flatMap(({ casFiles, htmlFiles }) => [
    ...casFiles.map(fileSource),
    ...htmlFiles.flatMap((file) => pages.get(file) ?? []),
  ])) {
    sources.set(source.kind === "file" ? source.path : source.htmlFile, source);
  }
  return [...sources.values()];
};

const renewSource = async (
  source: CasSource,
  config: RenewConfig,
  options: RenewOptions & { withinDays: number },
): Promise<boolean> => {
  const label = labelOf(source);
  try {
    const cas = await readCas(source, config.issuer);
    if (
      cas === undefined ||
      (!options.all && !isExpiring(cas.expiresAt, options.withinDays))
    ) {
      return false;
    }
    await upsertOwnCa(
      source,
      await options.signer.reSign(cas.payload, label),
      config,
    );
    return true;
  } catch (error) {
    throw new Error(`renew ${label}`, { cause: error });
  }
};

export const renew = async (
  config: RenewConfig,
  options: RenewOptions,
): Promise<string[]> => {
  const withinDays = options.withinDays ?? config.renewWithinDays;
  const sources = await collect(config, options.paths ?? []);
  const renewed: string[] = [];
  for (const source of sources) {
    // oxlint-disable-next-line no-await-in-loop -- CA Server に再署名をまとめて送らず、1 件ずつ頼む
    if (await renewSource(source, config, { ...options, withinDays })) {
      renewed.push(labelOf(source));
      options.log.log(`✓ Renewed ${labelOf(source)}`);
    }
  }
  options.log.log(
    `Renewed ${renewed.length} of ${sources.length} CAS (${options.all ? "all" : `expiring within ${withinDays} days`})`,
  );
  return renewed;
};
