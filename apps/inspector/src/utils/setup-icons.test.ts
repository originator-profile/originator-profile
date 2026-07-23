import { iconLoaded } from "@iconify/react";
import { describe, expect, test } from "vitest";
import "./setup-icons";

// アプリ内で実際に icon="prefix:name" として参照している名前一覧。
// (GlobalHeader.tsx, CaFilter.tsx, CheckList.tsx, ReliabilityGuide.tsx,
//  WebMediaProfileSummary.tsx, BackHeader.tsx, templates/Org.tsx,
//  templates/Warning.tsx, templates/DetailInfo.tsx,
//  packages/ui の CertificateDetail.tsx で使用)
const usedIconNames = [
  "fa6-solid:arrow-right",
  "fa6-solid:arrow-up-right-from-square",
  "fa6-solid:check",
  "fa6-solid:chevron-left",
  "fa6-solid:triangle-exclamation",
  "gg:check-o",
  "ic:round-cancel",
  "ic:round-check",
  "ic:round-warning",
  "ion:filter",
  "material-symbols:help",
  "mdi:ellipsis-vertical",
  "mdi:refresh",
  "solar:alt-arrow-right-bold",
];

describe("setup-icons", () => {
  test.each(usedIconNames)(
    "%s はローカル登録済みで Iconify API への問い合わせが発生しない",
    (name) => {
      expect(iconLoaded(name)).toBe(true);
    },
  );
});
