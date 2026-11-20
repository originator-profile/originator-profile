import { describe, expect, test, vi } from "vitest";
import { tabViewOf } from "./tab-view";
import {
  ca,
  document,
  failure,
  originator,
  settled,
  subFrame,
  subscribed,
  success,
  topFrame,
} from "./test-fixtures";

// NOTE: extension-common が読み込む webextension-polyfill は、拡張機能の外では
// 読み込みを拒む。拡張機能の中に見せかける
vi.hoisted(() => {
  Object.assign(globalThis, { chrome: { runtime: { id: "test" } } });
});

const operator = "dns:operator.example";
const publisher = "dns:publisher.example";
const advertiser = "dns:advertiser.example";

const site = (issuer = operator) =>
  success({
    originators: [originator(operator, { name: "operator" })],
    sites: [{ issuer, credentialSubject: { name: "Example Media" } }],
  });

const article = ca(publisher, "urn:uuid:article");
const topDocument = document(
  [originator(publisher, { name: "publisher" })],
  [{ main: true, attestation: article }],
);

describe("tabViewOf", () => {
  test("Site Profile が確定するまで読み込み中", () => {
    const view = tabViewOf(
      subscribed({
        frames: [{ frame: topFrame, entry: settled(topFrame, topDocument) }],
      }),
    );
    expect(view).toEqual({ state: "loading", origin: "https://media.example" });
  });

  test("確定していないサブフレームの文書は、確定するまで提示に加えない", () => {
    const view = tabViewOf(
      subscribed({
        frames: [
          { frame: topFrame, entry: settled(topFrame, topDocument) },
          {
            frame: subFrame,
            entry: { state: "verifying", subject: subFrame } as never,
          },
        ],
        siteProfile: site(),
      }),
    );
    expect(view.state === "ready" && view.contents).toHaveLength(1);
  });

  test("運営者と作成者が異なれば、運営者を提示する", () => {
    const view = tabViewOf(
      subscribed({
        frames: [{ frame: topFrame, entry: settled(topFrame, topDocument) }],
        siteProfile: site(),
      }),
    );
    expect(view.state).toBe("ready");
    if (view.state !== "ready") return;
    expect(view.site).toMatchObject({
      state: "present",
      name: "Example Media",
      operator: { id: operator },
    });
    expect(view.contents.map(({ key }) => key)).toEqual([
      `${publisher}:urn:uuid:article`,
    ]);
    expect(view.issuers.get(publisher)?.media?.credentialSubject.name).toBe(
      "publisher",
    );
  });

  test("運営者がメインのコンテンツの作成者と同じなら、サイト名だけを提示する", () => {
    const view = tabViewOf(
      subscribed({
        frames: [{ frame: topFrame, entry: settled(topFrame, topDocument) }],
        siteProfile: site(publisher),
      }),
    );
    expect(view).toMatchObject({
      state: "ready",
      site: { state: "same-as-main", name: "Example Media" },
    });
  });

  test("Site Profile が無ければ運営者を確認できないことを示す", () => {
    const view = tabViewOf(
      subscribed({
        frames: [
          {
            frame: topFrame,
            entry: settled(topFrame, topDocument, { usesSiteProfile: false }),
          },
        ],
        siteProfile: failure("ERR_SITE_PROFILE_FETCH_FAILED"),
      }),
    );
    expect(view).toMatchObject({ state: "ready", site: { state: "absent" } });
  });

  test("Site Profile も CA も無ければ未対応", () => {
    const view = tabViewOf(
      subscribed({
        frames: [
          {
            frame: topFrame,
            entry: settled(topFrame, document([], []), {
              usesSiteProfile: false,
            }),
          },
        ],
        siteProfile: failure("ERR_SITE_PROFILE_FETCH_FAILED"),
      }),
    );
    expect(view).toEqual({
      state: "unsupported",
      codes: ["ERR_SITE_PROFILE_FETCH_FAILED"],
    });
  });

  test.each([
    ["ERR_SITE_PROFILE_VERIFY_FAILED", "site"],
    ["ERR_SITE_PROFILE_INVALID", "site"],
    ["ERR_ORIGINATOR_PROFILE_SET_VERIFY_FAILED", "document"],
    ["ERR_CONTENT_ATTESTATION_SET_VERIFY_FAILED", "document"],
  ])("%s なら閲覧禁止", (code, target) => {
    const view = tabViewOf(
      subscribed({
        frames: [
          {
            frame: topFrame,
            entry: settled(
              topFrame,
              target === "document" ? failure(code) : topDocument,
            ),
          },
        ],
        siteProfile: target === "site" ? failure(code) : site(),
      }),
    );
    expect(view).toEqual({ state: "prohibited" });
  });

  test("OPS の形式が無効でも Site Profile があれば表示する", () => {
    const view = tabViewOf(
      subscribed({
        frames: [
          {
            frame: topFrame,
            entry: settled(
              topFrame,
              failure("ERR_ORIGINATOR_PROFILE_SET_INVALID"),
            ),
          },
        ],
        siteProfile: site(),
      }),
    );
    expect(view).toMatchObject({
      state: "ready",
      site: { state: "present" },
      contents: [],
    });
  });

  test("結果が無効になっていれば未対応とし、その理由を示す", () => {
    const view = tabViewOf(
      subscribed({
        frames: [
          {
            frame: topFrame,
            entry: {
              ...settled(topFrame, topDocument),
              state: "invalidated",
            } as never,
          },
        ],
        siteProfile: failure("ERR_SITE_PROFILE_FETCH_FAILED"),
      }),
    );
    expect(view).toEqual({
      state: "unsupported",
      codes: ["ERR_SITE_PROFILE_FETCH_FAILED", "ERR_VERIFICATION_INVALIDATED"],
    });
  });

  test("fenced frame の CA は提示しない", () => {
    const fenced = { ...subFrame, frameType: "fenced_frame" as const };
    const view = tabViewOf(
      subscribed({
        frames: [
          { frame: topFrame, entry: settled(topFrame, topDocument) },
          {
            frame: fenced,
            entry: settled(
              fenced,
              document(
                [originator(advertiser, { name: "advertiser" })],
                [
                  {
                    main: false,
                    attestation: ca(advertiser, "urn:uuid:ad", {
                      type: "OnlineAd",
                    }),
                  },
                ],
              ),
            ),
          },
        ],
        siteProfile: site(),
      }),
    );
    expect(view.state === "ready" && view.contents).toHaveLength(1);
  });
});
