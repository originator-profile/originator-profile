import { join } from "node:path";
import { expect, test } from "vitest";
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
    "Scanned 3 page(s): ok=1 missing=1 drifted=1 expiring=0 orphan=1 stale-copy=1",
    `  - DRIFTED /b → ${join("dist", "b", "index.html")} (埋め込み) (target, headline)`,
    `  - MISSING /c → ${join("public", "cas", "c.cas.json")} [main に一致する要素がありません]`,
    `  - ORPHAN ${join("public", "cas", "gone.cas.json")} (報告のみ)`,
    `  - STALE-COPY ${join("dist", "cas", "a.cas.json")} (${join("public", "cas", "a.cas.json")} と揃っていない)`,
    "⚠ 1 page(s) が非推奨の application/cas+json を使っています。2027-11-01 以降はサポート外なので application/ca-set+json に替えてください",
  ]);
});

test("scanLines: orphan を判定していなければ注記し、署名するときは CA を作れないページを飛ばすと表示する", () => {
  const lines = scanLines({ ...scan, orphans: undefined }, { check: false });

  expect(lines[0]).toMatch(/orphan=0/);
  expect(lines.slice(-2)).toStrictEqual([
    "  (範囲を指定したので orphan は判定しない)",
    "⚠ 1 page(s) は CA を作れないため飛ばします",
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
    `✓ create ${join("public", "cas", "c.cas.json")}`,
  );
  expect(syncResultLines(report)).toStrictEqual([
    `✓ copy ${join("dist", "cas", "a.cas.json")}`,
    "✓ Nothing to sign.",
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
    "Missing tag: 1 page(s) (file)",
    "  - /a",
    "Stale integrity: 0 page(s)",
    "  - SKIP /b [挿入位置がありません]",
  ]);
  expect(injectReportLines(report, { check: false, mode: "inline" })[0]).toBe(
    "Injected: 1 page(s) (inline)",
  );
});

test("renewedLine と renewReportLine: 再署名した CAS と件数を表示する", () => {
  const cas = {
    kind: "inline",
    htmlFile: here("dist", "a", "index.html"),
  } as const;

  expect(renewedLine(cas)).toBe(
    `✓ Renewed ${join("dist", "a", "index.html")} (埋め込み)`,
  );
  expect(
    renewReportLine({ renewed: [cas], total: 3, withinDays: 30, all: false }),
  ).toBe("Renewed 1 of 3 CAS (expiring within 30 days)");
  expect(
    renewReportLine({ renewed: [cas], total: 3, withinDays: 30, all: true }),
  ).toBe("Renewed 1 of 3 CAS (all)");
});
