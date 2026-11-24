import { relative } from "node:path";
import {
  CAS_SCRIPT_TYPE,
  DEPRECATED_CAS_SCRIPT_TYPE,
  DEPRECATED_CAS_SCRIPT_TYPE_UNTIL,
  type CasLocation,
} from "../cas/source.ts";
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

export const labelOf = (location: CasLocation): string => shown(location.path);

const pageLine = (page: PageReport) => {
  const detail =
    page.status === "expired"
      ? ` (${page.expiresAt ?? "exp なし"})`
      : page.drift
        ? ` (${page.drift.join(", ")})`
        : "";
  return `  - ${page.status.toUpperCase()} ${page.pathname} → ${labelOf(page.cas)}${detail}${page.problem ? ` [${page.problem}]` : ""}`;
};

const actionLabel = (action: IssuedPage["action"]): string =>
  action === "create" ? "作成" : "更新";

export const scanLines = (
  { pages, orphans, staleCopies }: ScanReport,
  options: { check: boolean },
): string[] => {
  const count = (status: PageStatus) =>
    pages.filter((page) => page.status === status).length;
  const expired = count("expired");
  const deprecated = pages.filter((page) => page.deprecatedType);
  const unissuable = pages.filter((page) => page.problem !== undefined);
  return [
    `${pages.length} ページを調べました: ok=${count("ok")} missing=${count("missing")} drifted=${count("drifted")} expired=${expired} orphan=${orphans.length} stale-copy=${staleCopies.length}`,
    ...pages
      .filter((page) => page.status !== "ok" || page.problem)
      .map(pageLine),
    ...orphans.map((orphan) => `  - ORPHAN ${shown(orphan)} (報告のみ)`),
    ...staleCopies.map(
      ({ from, to }) =>
        `  - STALE-COPY ${shown(to)} (${shown(from)} と揃っていない)`,
    ),
    ...(deprecated.length > 0
      ? [
          `⚠ ${deprecated.length} ページが非推奨の ${DEPRECATED_CAS_SCRIPT_TYPE} を使っています。${DEPRECATED_CAS_SCRIPT_TYPE_UNTIL} 以降はサポート外なので ${CAS_SCRIPT_TYPE} に替えてください`,
        ]
      : []),
    ...(expired > 0
      ? [`⚠ ${expired} 件の CA が期限切れです。opca renew で再署名してください`]
      : []),
    ...(!options.check && unissuable.length > 0
      ? [`⚠ ${unissuable.length} ページは CA を作れないため飛ばします`]
      : []),
  ];
};

export const issuedLine = (page: IssuedPage): string =>
  `✓ ${actionLabel(page.action)} ${labelOf(page.cas)}`;

export const syncResultLines = (report: SyncReport): string[] => [
  ...report.copied.map((to) => `✓ コピー ${shown(to)}`),
  ...(report.issued.length > 0 ? [] : ["✓ 署名するページはありません"]),
];

export const injectReportLines = (
  report: InjectReport,
  options: { check: boolean },
): string[] => {
  const [tagVerb, integrityVerb] = options.check
    ? ["タグなし", "古い integrity"]
    : ["挿入した", "integrity を更新"];
  return [
    `${tagVerb}: ${report.injected.length} ページ`,
    ...report.injected.map((pathname) => `  - ${pathname}`),
    `${integrityVerb}: ${report.integrity.length} ページ`,
    ...report.integrity.map((pathname) => `  - ${pathname}`),
    ...report.problems.map(
      ({ pathname, problem }) => `  - スキップ ${pathname} [${problem}]`,
    ),
  ];
};

export const renewedLine = (cas: CasLocation): string =>
  `✓ 再署名 ${labelOf(cas)}`;

export const renewReportLine = (report: RenewReport): string =>
  `${report.total} 件中 ${report.renewed.length} 件の CAS を再署名しました（${report.all ? "すべて" : "期限切れ"}）`;
