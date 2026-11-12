import type { UnsignedContentAttestation } from "@originator-profile/model";
import { globby } from "globby";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import type { CaClient } from "../ca-client/create-ca-client.ts";
import type { CaConfig } from "./config.ts";
import { isExpiring } from "./expiry.ts";
import {
  buildUnsignedCa,
  isExcluded,
  metadataDiff,
  pathnameOf,
  UnissuableError,
  type MetadataField,
} from "./page.ts";
import { coversAll, resolveFiles } from "./paths.ts";
import {
  DEPRECATED_CAS_SCRIPT_TYPE,
  distCopyOf,
  driftOf,
  forEachPage,
  labelOf,
  localCasSourcesOf,
  ownCaSourceOf,
  readCas,
  recordedOf,
  upsertOwnCa,
  usesDeprecatedType,
  type Cas,
  type CasSource,
  type Page,
} from "./source.ts";

export type PageStatus = "ok" | "missing" | "drifted" | "expiring";

export type PageReport = {
  pathname: string;
  cas: string;
  status: PageStatus;
  expiresAt?: string;
  drift?: ("target" | MetadataField)[];
  deprecatedType?: true;
  problem?: string;
  issued?: "create" | "update";
};

export type SyncReport = {
  pages: PageReport[];
  orphans: string[];
  staleCopies: { from: string; to: string }[];
};

type Pending = {
  report: PageReport;
  source: CasSource;
  html: string;
  uca: UnsignedContentAttestation;
  existed: boolean;
};

type Log = Pick<Console, "log">;

type ScanState = {
  pages: PageReport[];
  pending: Pending[];
  referenced: Set<string>;
  staleCopies: SyncReport["staleCopies"];
};

type Drift = NonNullable<PageReport["drift"]>;

const staleCopyOf = async (
  source: CasSource,
  config: CaConfig,
): Promise<SyncReport["staleCopies"][number] | undefined> => {
  if (source.kind !== "file") {
    return undefined;
  }
  const copy = distCopyOf(source.path, config);
  if (copy === undefined) {
    return undefined;
  }
  const [deployed, published] = await Promise.all([
    readFile(copy, "utf-8").catch(() => undefined),
    readFile(source.path, "utf-8"),
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
  cas: Cas | undefined,
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
  cas: Cas | undefined,
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
  cas: Cas | undefined;
  drift: Drift;
  deprecatedType: boolean;
  problem: string | undefined;
}): PageReport => ({
  pathname: input.pathname,
  cas: labelOf(input.source),
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
): Promise<{ report: SyncReport; pending: Pending[] }> => {
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
  const orphans = coversAll(config.distDir, paths)
    ? await orphansOf(state.referenced)
    : [];
  return {
    report: { pages: state.pages, orphans, staleCopies: state.staleCopies },
    pending: state.pending,
  };
};

const shown = (file: string) => relative(process.cwd(), file);

const logReport = ({ pages, orphans, staleCopies }: SyncReport, log: Log) => {
  const count = (status: PageStatus) =>
    pages.filter((page) => page.status === status).length;
  log.log(
    `Scanned ${pages.length} page(s): ok=${count("ok")} missing=${count("missing")} drifted=${count("drifted")} expiring=${count("expiring")} orphan=${orphans.length} stale-copy=${staleCopies.length}`,
  );
  for (const page of pages.filter(
    (page) => page.status !== "ok" || page.problem,
  )) {
    const detail =
      page.status === "expiring"
        ? ` (期限 ${page.expiresAt ?? "なし"})`
        : page.drift
          ? ` (${page.drift.join(", ")})`
          : "";
    log.log(
      `  - ${page.status.toUpperCase()} ${page.pathname} → ${page.cas}${detail}${page.problem ? ` [${page.problem}]` : ""}`,
    );
  }
  for (const orphan of orphans) {
    log.log(`  - ORPHAN ${shown(orphan)} (報告のみ)`);
  }
  for (const { from, to } of staleCopies) {
    log.log(`  - STALE-COPY ${shown(to)} (${shown(from)} と揃っていない)`);
  }
  const deprecated = pages.filter((page) => page.deprecatedType);
  if (deprecated.length > 0) {
    log.log(
      `⚠ ${deprecated.length} page(s) が非推奨の ${DEPRECATED_CAS_SCRIPT_TYPE} を使っています。2027-11-01 以降はサポート外なので application/ca-set+json に替えてください`,
    );
  }
};

export class UnissuablePagesError extends Error {
  readonly pages: PageReport[];

  constructor(pages: PageReport[]) {
    super(
      [
        `${pages.length} page(s) から CA を作れません`,
        ...pages.map((page) => `  - ${page.pathname}: ${page.problem}`),
      ].join("\n"),
    );
    this.name = "UnissuablePagesError";
    this.pages = pages;
  }
}

const signPage = async (
  config: CaConfig,
  { report: page, source, html, uca, existed }: Pending,
  options: { signer: Pick<CaClient, "sign">; log: Log },
): Promise<void> => {
  let written: CasSource;
  try {
    written = await upsertOwnCa(source, await options.signer.sign(uca), config);
  } catch (error) {
    throw new Error(`sign ${page.pathname}`, { cause: error });
  }
  const { status } = await driftOf(written, html, config.issuer);
  if (status !== "ok") {
    throw new Error(
      `Inline verification failed: ${page.pathname} の CAS がビルド済みページと一致しません (${status})`,
    );
  }
  page.issued = existed ? "update" : "create";
  options.log.log(`✓ ${page.issued} ${page.cas}`);
};

const signPending = async (
  config: CaConfig,
  pending: Pending[],
  options: { signer?: Pick<CaClient, "sign">; log: Log },
): Promise<number> => {
  const { signer, log } = options;
  if (signer === undefined) {
    throw new Error("署名するには signer が必要です");
  }
  for (const item of pending) {
    // oxlint-disable-next-line no-await-in-loop -- 複数のページが同じ CAS ファイルを書き換えることがあるので、1 ページずつ署名して書く
    await signPage(config, item, { signer, log });
  }
  return pending.length;
};

const refreshCopies = async (
  staleCopies: SyncReport["staleCopies"],
  log: Log,
): Promise<void> => {
  const copies = new Map(staleCopies.map(({ from, to }) => [to, from]));
  const copied = await Promise.all(
    Array.from(copies, async ([to, from]) => {
      const content = await readFile(from, "utf-8");
      if ((await readFile(to, "utf-8").catch(() => undefined)) === content) {
        return undefined;
      }
      await mkdir(dirname(to), { recursive: true });
      await writeFile(to, content);
      return to;
    }),
  );
  for (const to of copied) {
    if (to !== undefined) {
      log.log(`✓ copy ${shown(to)}`);
    }
  }
};

export const sync = async (
  config: CaConfig,
  options: {
    check: boolean;
    paths?: string[];
    signer?: Pick<CaClient, "sign">;
    log: Log;
  },
): Promise<SyncReport> => {
  const paths = options.paths ?? [];
  const { report, pending } = await scan(config, paths);
  logReport(report, options.log);
  if (!coversAll(config.distDir, paths)) {
    options.log.log("  (範囲を指定したので orphan は判定しない)");
  }

  const unissuable = report.pages.filter((page) => page.problem !== undefined);
  if (options.check) {
    if (unissuable.length > 0) {
      throw new UnissuablePagesError(unissuable);
    }
    return report;
  }
  if (unissuable.length > 0) {
    options.log.log(
      `⚠ ${unissuable.length} page(s) は CA を作れないため飛ばします`,
    );
  }
  const signed =
    pending.length > 0 ? await signPending(config, pending, options) : 0;
  await refreshCopies(report.staleCopies, options.log);
  if (signed === 0) {
    options.log.log("✓ Nothing to sign.");
  }
  return report;
};
