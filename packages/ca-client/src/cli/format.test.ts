import { join } from "node:path";
import { expect, test } from "vitest";
import {
  CAS_SCRIPT_TYPE,
  DEPRECATED_CAS_SCRIPT_TYPE,
  DEPRECATED_CAS_SCRIPT_TYPE_UNTIL,
} from "../cas/source.ts";
import type { ScanReport, SyncReport } from "../operations/sync.ts";
import {
  injectReportLines,
  issuedLine,
  renewedLine,
  renewReportLine,
  scanLines,
  syncResultLines,
} from "./format.ts";

const here = (...path: string[]) => join(process.cwd(), ...path);

const scan: ScanReport = {
  pages: [
    {
      pathname: "/a",
      cas: { path: here("public", "cas", "a.cas.json") },
      status: "ok",
    },
    {
      pathname: "/b",
      cas: { path: here("public", "cas", "b.cas.json") },
      status: "drifted",
      drift: ["target", "headline"],
      deprecatedType: true,
    },
    {
      pathname: "/c",
      cas: { path: here("public", "cas", "c.cas.json") },
      status: "missing",
      problem: "main に一致する要素がありません",
    },
    {
      pathname: "/d",
      cas: { path: here("public", "cas", "d.cas.json") },
      status: "expired",
      expiresAt: "2026-11-01T00:00:00.000Z",
    },
  ],
  orphans: [here("public", "cas", "gone.cas.json")],
  staleCopies: [
    {
      from: here("public", "cas", "a.cas.json"),
      to: here("dist", "cas", "a.cas.json"),
    },
  ],
};

test("scanLines: 集計、ok 以外のページ、orphan、stale copy、非推奨の type を表示する", () => {
  expect(scanLines(scan, { check: true })).toStrictEqual([
    "4 ページを調べました: ok=1 missing=1 drifted=1 expired=1 orphan=1 stale-copy=1",
    `  - DRIFTED /b → ${join("public", "cas", "b.cas.json")} (target, headline)`,
    `  - MISSING /c → ${join("public", "cas", "c.cas.json")} [main に一致する要素がありません]`,
    `  - EXPIRED /d → ${join("public", "cas", "d.cas.json")} (2026-11-01T00:00:00.000Z)`,
    `  - ORPHAN ${join("public", "cas", "gone.cas.json")} (報告のみ)`,
    `  - STALE-COPY ${join("dist", "cas", "a.cas.json")} (${join("public", "cas", "a.cas.json")} と揃っていない)`,
    `⚠ 1 ページが非推奨の ${DEPRECATED_CAS_SCRIPT_TYPE} を使っています。${DEPRECATED_CAS_SCRIPT_TYPE_UNTIL} 以降はサポート外なので ${CAS_SCRIPT_TYPE} に替えてください`,
    "⚠ 1 件の CA が期限切れです。opca renew で再署名してください",
  ]);
});

test("scanLines: 署名するときは CA を作れないページを飛ばすと表示する", () => {
  const lines = scanLines(scan, { check: false });

  expect(lines.at(-1)).toBe("⚠ 1 ページは CA を作れないため飛ばします");
});

test("issuedLine と syncResultLines: 署名とコピーを表示し、署名が無ければそう表示する", () => {
  const issued = {
    pathname: "/c",
    cas: { path: here("public", "cas", "c.cas.json") },
    action: "create",
  } as const;
  const report: SyncReport = {
    ...scan,
    issued: [],
    copied: [here("dist", "cas", "a.cas.json")],
  };

  expect(issuedLine(issued)).toBe(
    `✓ 作成 ${join("public", "cas", "c.cas.json")}`,
  );
  expect(syncResultLines(report)).toStrictEqual([
    `✓ コピー ${join("dist", "cas", "a.cas.json")}`,
    "✓ 署名するページはありません",
  ]);
  expect(
    syncResultLines({ ...report, issued: [issued], copied: [] }),
  ).toStrictEqual([]);
});

test("injectReportLines: check の有無で見出しを変える", () => {
  const report = {
    injected: ["/a"],
    integrity: [],
    problems: [{ pathname: "/b", problem: "挿入位置がありません" }],
  };

  expect(injectReportLines(report, { check: true })).toStrictEqual([
    "タグなし: 1 ページ",
    "  - /a",
    "古い integrity: 0 ページ",
    "  - スキップ /b [挿入位置がありません]",
  ]);
  expect(injectReportLines(report, { check: false })[0]).toBe(
    "挿入した: 1 ページ",
  );
});

test("renewedLine と renewReportLine: 再署名した CAS と件数を表示する", () => {
  const cas = {
    path: here("public", "cas", "a.cas.json"),
  } as const;

  expect(renewedLine(cas)).toBe(
    `✓ 再署名 ${join("public", "cas", "a.cas.json")}`,
  );
  expect(renewReportLine({ renewed: [cas], total: 3, all: false })).toBe(
    "3 件中 1 件の CAS を再署名しました（期限切れ）",
  );
  expect(renewReportLine({ renewed: [cas], total: 3, all: true })).toBe(
    "3 件中 1 件の CAS を再署名しました（すべて）",
  );
});
