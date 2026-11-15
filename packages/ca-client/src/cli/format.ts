import { relative } from "node:path";
import { DEPRECATED_CAS_SCRIPT_TYPE, type CasLocation } from "../cas/source.ts";
import type { CasMode } from "../operations/config.ts";
import type { InjectReport } from "../operations/inject.ts";
import type { RenewReport } from "../operations/renew.ts";
import type {
  IssuedPage,
  PageReport,
  PageStatus,
  ScanReport,
  SyncReport,
} from "../operations/sync.ts";

const shown = (file: string) => relative(process.cwd(), file);

const labelOf = (location: CasLocation): string =>
  location.kind === "file"
    ? shown(location.path)
    : `${shown(location.htmlFile)} (埋め込み)`;

const pageLine = (page: PageReport) => {
  const detail =
    page.status === "expiring"
      ? ` (期限 ${page.expiresAt ?? "なし"})`
      : page.drift
        ? ` (${page.drift.join(", ")})`
        : "";
  return `  - ${page.status.toUpperCase()} ${page.pathname} → ${labelOf(page.cas)}${detail}${page.problem ? ` [${page.problem}]` : ""}`;
};

export const scanLines = (
  { pages, orphans, staleCopies }: ScanReport,
  options: { check: boolean },
): string[] => {
  const count = (status: PageStatus) =>
    pages.filter((page) => page.status === status).length;
  const deprecated = pages.filter((page) => page.deprecatedType);
  const unissuable = pages.filter((page) => page.problem !== undefined);
  return [
    `Scanned ${pages.length} page(s): ok=${count("ok")} missing=${count("missing")} drifted=${count("drifted")} expiring=${count("expiring")} orphan=${orphans?.length ?? 0} stale-copy=${staleCopies.length}`,
    ...pages
      .filter((page) => page.status !== "ok" || page.problem)
      .map(pageLine),
    ...(orphans ?? []).map(
      (orphan) => `  - ORPHAN ${shown(orphan)} (報告のみ)`,
    ),
    ...staleCopies.map(
      ({ from, to }) =>
        `  - STALE-COPY ${shown(to)} (${shown(from)} と揃っていない)`,
    ),
    ...(deprecated.length > 0
      ? [
          `⚠ ${deprecated.length} page(s) が非推奨の ${DEPRECATED_CAS_SCRIPT_TYPE} を使っています。2027-11-01 以降はサポート外なので application/ca-set+json に替えてください`,
        ]
      : []),
    ...(orphans ? [] : ["  (範囲を指定したので orphan は判定しない)"]),
    ...(!options.check && unissuable.length > 0
      ? [`⚠ ${unissuable.length} page(s) は CA を作れないため飛ばします`]
      : []),
  ];
};

export const issuedLine = (page: IssuedPage): string =>
  `✓ ${page.action} ${labelOf(page.cas)}`;

export const syncResultLines = (report: SyncReport): string[] => [
  ...report.copied.map((to) => `✓ copy ${shown(to)}`),
  ...(report.issued.length > 0 ? [] : ["✓ Nothing to sign."]),
];

export const injectReportLines = (
  report: InjectReport,
  options: { check: boolean; mode: CasMode },
): string[] => {
  const [tagVerb, integrityVerb] = options.check
    ? ["Missing tag", "Stale integrity"]
    : ["Injected", "Updated integrity"];
  return [
    `${tagVerb}: ${report.injected.length} page(s) (${options.mode})`,
    ...report.injected.map((pathname) => `  - ${pathname}`),
    `${integrityVerb}: ${report.integrity.length} page(s)`,
    ...report.integrity.map((pathname) => `  - ${pathname}`),
    ...report.problems.map(
      ({ pathname, problem }) => `  - SKIP ${pathname} [${problem}]`,
    ),
  ];
};

export const renewedLine = (cas: CasLocation): string =>
  `✓ Renewed ${labelOf(cas)}`;

export const renewReportLine = (report: RenewReport): string =>
  `Renewed ${report.renewed.length} of ${report.total} CAS (${report.all ? "all" : `expiring within ${report.withinDays} days`})`;
