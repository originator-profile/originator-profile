import type { CaClient } from "../ca-server/create-ca-client.ts";
import { isExpiring } from "../ca/expiry.ts";
import {
  locationOf,
  ownCaSourceOf,
  readCas,
  upsertOwnCa,
  whereOf,
  type CasLocation,
  type CasSource,
} from "../cas/source.ts";
import { withContext } from "../errors.ts";
import { matchFiles, notFound, resolveFiles } from "../utils/paths.ts";
import type { CaConfig } from "./config.ts";
import { forEachPage } from "./page.ts";

export type RenewOptions = {
  signer: Pick<CaClient, "reSign">;
  paths?: string[];
  /** 省略すると config.renewWithinDays。 */
  withinDays?: number;
  /** true なら期限に関わらず再署名する。 */
  all?: boolean;
  /** CAS を再署名して書くたびに呼ぶ。 */
  onRenewed?: (cas: CasLocation) => void;
};

export type RenewReport = {
  renewed: CasLocation[];
  /** 対象にした CAS の数。 */
  total: number;
  withinDays: number;
  all: boolean;
};

const fileSource = (path: string): CasSource => ({ kind: "file", path });

const pageSources = async (
  htmlFiles: string[],
  config: CaConfig,
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

const collectAll = async (config: CaConfig): Promise<CasSource[]> => [
  ...(await resolveFiles(config.publicDir, [], ".cas.json")).map(fileSource),
  ...[
    ...(
      await pageSources(await resolveFiles(config.distDir, [], ".html"), config)
    ).values(),
  ].filter((source) => source.kind === "inline"),
];

const collect = async (
  config: CaConfig,
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
  config: CaConfig,
  options: RenewOptions & { withinDays: number },
): Promise<boolean> => {
  const label = whereOf(source);
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
    throw withContext(`renew ${label}`, error);
  }
};

export const renew = async (
  config: CaConfig,
  options: RenewOptions,
): Promise<RenewReport> => {
  const withinDays = options.withinDays ?? config.renewWithinDays;
  const sources = await collect(config, options.paths ?? []);
  const renewed: CasLocation[] = [];
  for (const source of sources) {
    // oxlint-disable-next-line no-await-in-loop -- CA Server に再署名をまとめて送らず、1 件ずつ頼む
    if (await renewSource(source, config, { ...options, withinDays })) {
      const location = locationOf(source);
      renewed.push(location);
      options.onRenewed?.(location);
    }
  }
  return {
    renewed,
    total: sources.length,
    withinDays,
    all: options.all ?? false,
  };
};
