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
      cas: { kind: "file", path: here("public", "cas", "a.cas.json") },
      status: "ok",
    },
    {
      pathname: "/b",
      cas: { kind: "inline", htmlFile: here("dist", "b", "index.html") },
      status: "drifted",
      drift: ["target", "headline"],
      deprecatedType: true,
    },
    {
      pathname: "/c",
      cas: { kind: "file", path: here("public", "cas", "c.cas.json") },
      status: "missing",
      problem: "main に一致する要素がありません",
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
    "3 ページを調べました: ok=1 missing=1 drifted=1 expiring=0 orphan=1 stale-copy=1",
    `  - DRIFTED /b → ${join("dist", "b", "index.html")} (埋め込み) (target, headline)`,
    `  - MISSING /c → ${join("public", "cas", "c.cas.json")} [main に一致する要素がありません]`,
    `  - ORPHAN ${join("public", "cas", "gone.cas.json")} (報告のみ)`,
    `  - STALE-COPY ${join("dist", "cas", "a.cas.json")} (${join("public", "cas", "a.cas.json")} と揃っていない)`,
    `⚠ 1 ページが非推奨の ${DEPRECATED_CAS_SCRIPT_TYPE} を使っています。${DEPRECATED_CAS_SCRIPT_TYPE_UNTIL} 以降はサポート外なので ${CAS_SCRIPT_TYPE} に替えてください`,
  ]);
});

test("scanLines: orphan を判定していなければ注記し、署名するときは CA を作れないページを飛ばすと表示する", () => {
  const lines = scanLines({ ...scan, orphans: undefined }, { check: false });

  expect(lines[0]).toMatch(/orphan=0/);
  expect(lines.slice(-2)).toStrictEqual([
    "  (範囲を指定したので orphan は判定しない)",
    "⚠ 1 ページは CA を作れないため飛ばします",
  ]);
});

test("issuedLine と syncResultLines: 署名とコピーを表示し、署名が無ければそう表示する", () => {
  const issued = {
    pathname: "/c",
    cas: { kind: "file", path: here("public", "cas", "c.cas.json") },
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

  expect(
    injectReportLines(report, { check: true, mode: "file" }),
  ).toStrictEqual([
    "タグなし: 1 ページ (file)",
    "  - /a",
    "古い integrity: 0 ページ",
    "  - スキップ /b [挿入位置がありません]",
  ]);
  expect(injectReportLines(report, { check: false, mode: "inline" })[0]).toBe(
    "挿入した: 1 ページ (inline)",
  );
});

test("renewedLine と renewReportLine: 再署名した CAS と件数を表示する", () => {
  const cas = {
    kind: "inline",
    htmlFile: here("dist", "a", "index.html"),
  } as const;

  expect(renewedLine(cas)).toBe(
    `✓ 再署名 ${join("dist", "a", "index.html")} (埋め込み)`,
  );
  expect(
    renewReportLine({ renewed: [cas], total: 3, withinDays: 30, all: false }),
  ).toBe("3 件中 1 件の CAS を再署名しました（30 日以内に期限切れ）");
  expect(
    renewReportLine({ renewed: [cas], total: 3, withinDays: 30, all: true }),
  ).toBe("3 件中 1 件の CAS を再署名しました（すべて）");
});
