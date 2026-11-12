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
  labelOf,
  localCasSourcesOf,
  ownCaSourceOf,
  parseHtml,
  readCas,
  recordedOf,
  upsertOwnCa,
  usesDeprecatedType,
  type CasSource,
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

const scan = async (
  config: CaConfig,
  paths: string[],
): Promise<{ report: SyncReport; pending: Pending[] }> => {
  const pages: PageReport[] = [];
  const pending: Pending[] = [];
  const referenced = new Set<string>();
  const staleCopies: SyncReport["staleCopies"] = [];

  for (const htmlFile of await resolveFiles(config.distDir, paths, ".html")) {
    const html = await readFile(htmlFile, "utf-8");
    const dom = parseHtml(html);
    try {
      for (const source of localCasSourcesOf(dom, config, htmlFile, html)) {
        if (source.kind === "file") {
          referenced.add(source.path);
        }
      }
      const source = await ownCaSourceOf(dom, config, htmlFile, html);
      if (source === undefined) {
        continue;
      }
      const pathname = pathnameOf(config.distDir, htmlFile);
      if (isExcluded(config, pathname)) {
        continue;
      }
      const cas = await readCas(source, config.issuer);
      const copy = source.kind === "file" && distCopyOf(source.path, config);
      if (
        copy &&
        cas !== undefined &&
        (await readFile(copy, "utf-8").catch(() => undefined)) !==
          (await readFile(source.path, "utf-8"))
      ) {
        staleCopies.push({ from: source.path, to: copy });
      }
      let uca: UnsignedContentAttestation | undefined;
      let problem: string | undefined;
      try {
        uca = buildUnsignedCa({
          config,
          document: dom.window.document,
          pathname,
          recorded: cas && recordedOf(cas.payload),
          content: html,
        });
      } catch (error) {
        if (!(error instanceof UnissuableError)) {
          throw error;
        }
        problem = error.message;
      }
      const drift =
        cas === undefined
          ? []
          : [
              ...((await driftOf(source, html, config.issuer)).status !== "ok"
                ? ["target" as const]
                : []),
              ...(uca ? metadataDiff(uca, cas.payload) : []),
            ];
      const status: PageStatus =
        cas === undefined
          ? "missing"
          : drift.length > 0
            ? "drifted"
            : isExpiring(cas.expiresAt, config.renewWithinDays)
              ? "expiring"
              : "ok";
      const report: PageReport = {
        pathname,
        cas: labelOf(source),
        status,
        ...(cas?.expiresAt ? { expiresAt: cas.expiresAt.toISOString() } : {}),
        ...(drift.length > 0 ? { drift } : {}),
        ...(usesDeprecatedType(dom) ? { deprecatedType: true } : {}),
        ...(problem ? { problem } : {}),
      };
      pages.push(report);
      if (status !== "ok" && uca !== undefined) {
        pending.push({ report, source, html, uca, existed: cas !== undefined });
      }
    } finally {
      dom.window.close();
    }
  }

  const orphans: string[] = [];
  if (!coversAll(config.distDir, paths)) {
    return { report: { pages, orphans, staleCopies }, pending };
  }
  const dirs = new Set([...referenced].map((file) => dirname(file)));
  for (const dir of dirs) {
    for (const file of await globby("*.cas.json", {
      cwd: dir,
      absolute: true,
    })) {
      if (!referenced.has(file)) {
        orphans.push(file);
      }
    }
  }
  return {
    report: { pages, orphans: orphans.sort(), staleCopies },
    pending,
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

const signPending = async (
  config: CaConfig,
  pending: Pending[],
  options: { signer?: Pick<CaClient, "sign">; log: Log },
): Promise<number> => {
  if (options.signer === undefined) {
    throw new Error("署名するには signer が必要です");
  }
  for (const { report: page, source, html, uca, existed } of pending) {
    let written: CasSource;
    try {
      written = await upsertOwnCa(
        source,
        await options.signer.sign(uca),
        config,
      );
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
  }
  return pending.length;
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
  for (const { from, to } of report.staleCopies) {
    const content = await readFile(from, "utf-8");
    if ((await readFile(to, "utf-8").catch(() => undefined)) !== content) {
      await mkdir(dirname(to), { recursive: true });
      await writeFile(to, content);
      options.log.log(`✓ copy ${shown(to)}`);
    }
  }
  if (signed === 0) {
    options.log.log("✓ Nothing to sign.");
  }
  return report;
};
