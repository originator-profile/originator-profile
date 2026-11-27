import { describe, expect, test } from "vitest";
import type { Content } from "./contents";
import { launcherOf } from "./launcher";
import type { SiteView, TabView } from "./tab-view";
import { subFrame, topFrame } from "./test-fixtures";

type Ready = Extract<TabView, { state: "ready" }>;

const content = (main: boolean, frame = topFrame) =>
  ({
    key: `${main}:${frame.documentId}`,
    main,
    frames: [frame],
  }) as unknown as Content;

const view = ({
  site = { state: "absent" },
  contents = [],
  failed = false,
}: {
  site?: SiteView;
  contents?: Content[];
  failed?: boolean;
}): Ready => ({
  state: "ready",
  tabId: 1,
  site,
  contents,
  issuers: new Map(),
  originators: [],
  failed,
});

const present: SiteView = {
  state: "present",
  name: "Example Media",
  operator: { id: "dns:operator.example", annotations: [] },
};

describe("launcherOf", () => {
  test.each([
    [
      "Site Profile とメインを確認",
      view({ site: present, contents: [content(true)] }),
      { icon: "verified", tooltip: "Launcher_SiteAndMain" },
    ],
    [
      "Site Profile を確認し、メインは確認できない (ほかのコンテンツの有無によらない)",
      view({ site: present, contents: [content(false)] }),
      { icon: "partial", tooltip: "Launcher_SiteOnly" },
    ],
    [
      "メインを確認し、Site Profile は確認できない",
      view({ contents: [content(true)], failed: true }),
      { icon: "partial", tooltip: "Launcher_MainOnly" },
    ],
    [
      "ページ本体のメイン以外のコンテンツだけを確認",
      view({ contents: [content(false), content(false, subFrame)] }),
      { icon: "partial", tooltip: "Launcher_PageContentOnly" },
    ],
    [
      "確認に失敗した",
      view({ contents: [content(false, subFrame)], failed: true }),
      { icon: "none", tooltip: "Launcher_Failed" },
    ],
    [
      "埋め込みのコンテンツにだけある",
      view({ contents: [content(false, subFrame)] }),
      { icon: "none", tooltip: "Launcher_EmbeddedOnly" },
    ],
    [
      "出どころの情報が無い",
      view({}),
      { icon: "none", tooltip: "Launcher_NoOrigin" },
    ],
  ])("%s", (_, ready, expected) => {
    expect(launcherOf(ready)).toEqual(expected);
  });
});
