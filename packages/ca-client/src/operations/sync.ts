import type { UnsignedContentAttestation } from "@originator-profile/model";
import { globby } from "globby";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CaClient } from "../ca-server/create-ca-client.ts";
import type { DecodedCa } from "../ca/decode.ts";
import { isExpiring } from "../ca/expiry.ts";
import {
  distCopyOf,
  driftOf,
  localCasSourcesOf,
  locationOf,
  ownCaSourceOf,
  readCas,
  recordedOf,
  upsertOwnCa,
  usesDeprecatedType,
  type CasLocation,
  type CasSource,
} from "../cas/source.ts";
import { CaClientError, CaClientErrorCode, withContext } from "../errors.ts";
import { readText, writeText } from "../utils/file.ts";
import { coversAll, resolveFiles } from "../utils/paths.ts";
import type { CaConfig } from "./config.ts";
import {
  buildUnsignedCa,
  forEachPage,
  isExcluded,
  metadataDiff,
  pathnameOf,
  UnissuableError,
  type MetadataField,
  type Page,
} from "./page.ts";

export type PageStatus = "ok" | "missing" | "drifted" | "expiring";

export type PageReport = {
  pathname: string;
  cas: CasLocation;
  status: PageStatus;
  expiresAt?: string;
  drift?: ("target" | MetadataField)[];
  deprecatedType?: true;
  problem?: string;
};

export type ScanReport = {
  pages: PageReport[];
  /** paths で範囲を絞ったときは判定しないので undefined。 */
  orphans?: string[];
  staleCopies: { from: string; to: string }[];
};

export type IssuedPage = {
  pathname: string;
  cas: CasLocation;
  action: "create" | "update";
};

export type SyncReport = ScanReport & {
  issued: IssuedPage[];
  /** staleCopies のうち、書き直した distDir 側のコピー。 */
  copied: string[];
};

export type SyncOptions = {
  paths?: string[];
  /** ページを照合し終え、署名を始める前に呼ぶ。 */
  onScanned?: (report: ScanReport) => void;
} & (
  | {
      /** CAS を書かず、照合した結果だけを返す。 */
      check: true;
    }
  | {
      check: false;
      signer: Pick<CaClient, "sign">;
      /** ページの CA を署名して書くたびに呼ぶ。 */
      onIssued?: (page: IssuedPage) => void;
    }
);

type Pending = {
  report: PageReport;
  source: CasSource;
  html: string;
  uca: UnsignedContentAttestation;
  existed: boolean;
};

type ScanState = {
  pages: PageReport[];
  pending: Pending[];
  referenced: Set<string>;
  staleCopies: ScanReport["staleCopies"];
};

type Drift = NonNullable<PageReport["drift"]>;

const staleCopyOf = async (
  source: CasSource,
  config: CaConfig,
): Promise<ScanReport["staleCopies"][number] | undefined> => {
  if (source.kind !== "file") {
    return undefined;
  }
  const copy = distCopyOf(source.path, config);
  if (copy === undefined) {
    return undefined;
  }
  const [deployed, published] = await Promise.all([
    readFile(copy, "utf-8").catch(() => undefined),
    readText(source.path),
  ]);
  return deployed === published ? undefined : { from: source.path, to: copy };
};

const unsignedCaOf = (
  input: Parameters<typeof buildUnsignedCa>[0],
): { uca?: UnsignedContentAttestation; problem?: string } => {
  try {
    return { uca: buildUnsignedCa(input) };
  } catch (error) {
    if (!(error instanceof UnissuableError)) {
      throw error;
    }
    return { problem: error.message };
  }
};

const driftOfPage = async (
  page: { source: CasSource; html: string; issuer: string },
  cas: DecodedCa | undefined,
  uca: UnsignedContentAttestation | undefined,
): Promise<Drift> => {
  if (cas === undefined) {
    return [];
  }
  const { status } = await driftOf(page.source, page.html, page.issuer);
  return [
    ...(status === "ok" ? [] : ["target" as const]),
    ...(uca ? metadataDiff(uca, cas.payload) : []),
  ];
};

const statusOf = (
  cas: DecodedCa | undefined,
  drift: Drift,
  renewWithinDays: number,
): PageStatus => {
  if (cas === undefined) {
    return "missing";
  }
  if (drift.length > 0) {
    return "drifted";
  }
  return isExpiring(cas.expiresAt, renewWithinDays) ? "expiring" : "ok";
};

const pageReportOf = (input: {
  pathname: string;
  source: CasSource;
  status: PageStatus;
  cas: DecodedCa | undefined;
  drift: Drift;
  deprecatedType: boolean;
  problem: string | undefined;
}): PageReport => ({
  pathname: input.pathname,
  cas: locationOf(input.source),
  status: input.status,
  ...(input.cas?.expiresAt
    ? { expiresAt: input.cas.expiresAt.toISOString() }
    : {}),
  ...(input.drift.length > 0 ? { drift: input.drift } : {}),
  ...(input.deprecatedType ? { deprecatedType: true } : {}),
  ...(input.problem ? { problem: input.problem } : {}),
});

const scanPage = async (
  config: CaConfig,
  { file: htmlFile, html, dom }: Page,
  state: ScanState,
): Promise<void> => {
  for (const source of localCasSourcesOf(dom, config, htmlFile, html)) {
    if (source.kind === "file") {
      state.referenced.add(source.path);
    }
  }
  const source = await ownCaSourceOf(dom, config, htmlFile, html);
  const pathname = pathnameOf(config.distDir, htmlFile);
  if (source === undefined || isExcluded(config, pathname)) {
    return;
  }
  const cas = await readCas(source, config.issuer);
  const staleCopy = cas && (await staleCopyOf(source, config));
  if (staleCopy) {
    state.staleCopies.push(staleCopy);
  }
  const { uca, problem } = unsignedCaOf({
    config,
    document: dom.window.document,
    pathname,
    recorded: cas && recordedOf(cas.payload),
    content: html,
  });
  const drift = await driftOfPage(
    { source, html, issuer: config.issuer },
    cas,
    uca,
  );
  const status = statusOf(cas, drift, config.renewWithinDays);
  const report = pageReportOf({
    pathname,
    source,
    status,
    cas,
    drift,
    deprecatedType: usesDeprecatedType(dom),
    problem,
  });
  state.pages.push(report);
  if (status !== "ok" && uca !== undefined) {
    state.pending.push({
      report,
      source,
      html,
      uca,
      existed: cas !== undefined,
    });
  }
};

const orphansOf = async (referenced: Set<string>): Promise<string[]> => {
  const dirs = [...new Set([...referenced].map((file) => dirname(file)))];
  const files = await Promise.all(
    dirs.map((cwd) => globby("*.cas.json", { cwd, absolute: true })),
  );
  return files
    .flat()
    .filter((file) => !referenced.has(file))
    .sort();
};

const scan = async (
  config: CaConfig,
  paths: string[],
): Promise<{ report: ScanReport; pending: Pending[] }> => {
  const state: ScanState = {
    pages: [],
    pending: [],
    referenced: new Set(),
    staleCopies: [],
  };
  await forEachPage(
    await resolveFiles(config.distDir, paths, ".html"),
    (page) => scanPage(config, page, state),
  );
  return {
    report: {
      pages: state.pages,
      ...(coversAll(config.distDir, paths)
        ? { orphans: await orphansOf(state.referenced) }
        : {}),
      staleCopies: state.staleCopies,
    },
    pending: state.pending,
  };
};

export class UnissuablePagesError extends CaClientError {
  readonly pages: PageReport[];

  constructor(pages: PageReport[]) {
    super(
      [
        `Cannot build a CA for ${pages.length} page(s)`,
        ...pages.map((page) => `  - ${page.pathname}: ${page.problem}`),
      ].join("\n"),
      { code: CaClientErrorCode.Validation },
    );
    this.name = "UnissuablePagesError";
    this.pages = pages;
  }
}

type SignOptions = Extract<SyncOptions, { check: false }>;

const signPage = async (
  config: CaConfig,
  { report: page, source, html, uca, existed }: Pending,
  options: SignOptions,
): Promise<IssuedPage> => {
  let written: CasSource;
  try {
    written = await upsertOwnCa(source, await options.signer.sign(uca), config);
  } catch (error) {
    throw withContext(`sign ${page.pathname}`, error);
  }
  const { status } = await driftOf(written, html, config.issuer);
  if (status !== "ok") {
    throw new CaClientError(
      `Inline verification failed: the CAS for ${page.pathname} does not match the built page (${status})`,
      { code: CaClientErrorCode.Verification },
    );
  }
  const issued: IssuedPage = {
    pathname: page.pathname,
    cas: page.cas,
    action: existed ? "update" : "create",
  };
  options.onIssued?.(issued);
  return issued;
};

const signPending = async (
  config: CaConfig,
  pending: Pending[],
  options: SignOptions,
): Promise<IssuedPage[]> => {
  const issued: IssuedPage[] = [];
  for (const item of pending) {
    // oxlint-disable-next-line no-await-in-loop -- 複数のページが同じ CAS ファイルを書き換えることがあるので、1 ページずつ署名して書く
    issued.push(await signPage(config, item, options));
  }
  return issued;
};

const refreshCopies = async (
  staleCopies: ScanReport["staleCopies"],
): Promise<string[]> => {
  const copies = new Map(staleCopies.map(({ from, to }) => [to, from]));
  const copied = await Promise.all(
    Array.from(copies, async ([to, from]) => {
      const content = await readText(from);
      if ((await readFile(to, "utf-8").catch(() => undefined)) === content) {
        return undefined;
      }
      await writeText(to, content);
      return to;
    }),
  );
  return copied.filter((to) => to !== undefined);
};

export const sync = async (
  config: CaConfig,
  options: SyncOptions,
): Promise<SyncReport> => {
  const { report, pending } = await scan(config, options.paths ?? []);
  options.onScanned?.(report);
  if (options.check) {
    const unissuable = report.pages.filter(
      (page) => page.problem !== undefined,
    );
    if (unissuable.length > 0) {
      throw new UnissuablePagesError(unissuable);
    }
    return { ...report, issued: [], copied: [] };
  }
  const issued = await signPending(config, pending, options);
  const copied = await refreshCopies(report.staleCopies);
  return { ...report, issued, copied };
};
