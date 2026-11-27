import type { SubscribedTabVerification } from "@originator-profile/extension-common";
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

const subFrameOf = (documentId: string, frameId: number) => ({
  ...subFrame,
  frameId,
  documentId,
});

/** サブフレームの、広告 1 件を載せた文書 */
const adDocument = (id: string) =>
  document(
    [originator(advertiser, { name: "advertiser" })],
    [{ main: false, attestation: ca(advertiser, id, { type: "OnlineAd" }) }],
  );

const keysOf = (view: ReturnType<typeof tabViewOf>) =>
  view.state === "ready" ? view.contents.map(({ key }) => key) : undefined;

const invalidated = (entry: unknown) =>
  ({ ...(entry as object), state: "invalidated" }) as never;

describe("tabViewOf", () => {
  test("Site Profile が確定するまで読み込み中", () => {
    const view = tabViewOf(
      1,
      subscribed({
        frames: [{ frame: topFrame, entry: settled(topFrame, topDocument) }],
      }),
    );
    expect(view).toEqual({ state: "loading", origin: "https://media.example" });
  });

  test("文書を提示できるときは、レジストリが揃うまで読み込み中", () => {
    const view = tabViewOf(
      1,
      subscribed({
        frames: [{ frame: topFrame, entry: settled(topFrame, topDocument) }],
        siteProfile: site(),
        registry: null,
      }),
    );
    expect(view.state).toBe("loading");
  });

  test("確定していないサブフレームの文書は、確定するまで提示に加えない", () => {
    const view = tabViewOf(
      1,
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

  test("運営者と提供者が異なれば、運営者を提示する", () => {
    const view = tabViewOf(
      1,
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
    expect(keysOf(view)).toEqual([`${publisher}:urn:uuid:article`]);
    expect(view.issuers.get(publisher)?.media?.credentialSubject.name).toBe(
      "publisher",
    );
    expect(view.failed).toBe(false);
  });

  test("運営者がメインのコンテンツの提供者と同じなら、サイト名だけを提示する", () => {
    const view = tabViewOf(
      1,
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

  test("サブフレームのメインはメインとして扱わず、運営者と比べない", () => {
    const sub = document(
      [originator(publisher, { name: "publisher" })],
      [{ main: true, attestation: article }],
    );
    const view = tabViewOf(
      1,
      subscribed({
        frames: [
          {
            frame: topFrame,
            entry: settled(topFrame, document([], [])),
          },
          { frame: subFrame, entry: settled(subFrame, sub) },
        ],
        siteProfile: site(publisher),
      }),
    );
    expect(view).toMatchObject({
      state: "ready",
      contents: [{ main: false }],
      site: { state: "present", operator: { id: publisher } },
    });
  });

  test("Site Profile を置いていなければ、運営者を確認できないことを示す", () => {
    const view = tabViewOf(
      1,
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
    expect(view).toMatchObject({
      state: "ready",
      site: { state: "absent" },
      failed: false,
    });
  });

  test.each(["ERR_SITE_PROFILE_VERIFY_FAILED", "ERR_SITE_PROFILE_INVALID"])(
    "Site Profile が %s なら運営者を確認できないとし、コンテンツは提示する",
    (code) => {
      const view = tabViewOf(
        1,
        subscribed({
          frames: [
            {
              frame: topFrame,
              entry: settled(topFrame, topDocument, { usesSiteProfile: false }),
            },
          ],
          siteProfile: failure(code),
        }),
      );
      expect(view).toMatchObject({
        state: "ready",
        site: { state: "absent" },
        failed: true,
      });
      expect(keysOf(view)).toEqual([`${publisher}:urn:uuid:article`]);
    },
  );

  test("Site Profile の結果が無効になれば、運営者を確認できないとする", () => {
    const subscription = subscribed({
      frames: [{ frame: topFrame, entry: settled(topFrame, topDocument) }],
      siteProfile: site(),
    });
    const verification = subscription.verification;
    if (!verification) throw new Error("verification not found");
    const view = tabViewOf(1, {
      ...subscription,
      verification: {
        ...verification,
        siteProfile: invalidated(verification.siteProfile),
      },
    });
    expect(view).toMatchObject({
      state: "ready",
      site: { state: "absent" },
      failed: true,
    });
  });

  test("Site Profile も CA も無ければ、どちらも無いことを示す", () => {
    const view = tabViewOf(
      1,
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
    expect(view).toMatchObject({
      state: "ready",
      site: { state: "absent" },
      contents: [],
      failed: false,
    });
  });

  test.each([
    "ERR_ORIGINATOR_PROFILE_SET_INVALID",
    "ERR_ORIGINATOR_PROFILE_SET_VERIFY_FAILED",
    "ERR_CONTENT_ATTESTATION_SET_VERIFY_FAILED",
  ])(
    "トップレベル文書が %s ならメインは無いとし、サブフレームのコンテンツは提示する",
    (code) => {
      const view = tabViewOf(
        1,
        subscribed({
          frames: [
            { frame: topFrame, entry: settled(topFrame, failure(code)) },
            {
              frame: subFrame,
              entry: settled(subFrame, adDocument("urn:uuid:ad")),
            },
          ],
          siteProfile: site(),
        }),
      );
      expect(view).toMatchObject({ state: "ready", failed: true });
      expect(keysOf(view)).toEqual([`${advertiser}:urn:uuid:ad`]);
    },
  );

  test("トップレベル文書の結果が無効になれば、メインは無いとする", () => {
    const view = tabViewOf(
      1,
      subscribed({
        frames: [
          {
            frame: topFrame,
            entry: invalidated(settled(topFrame, topDocument)),
          },
        ],
        siteProfile: site(),
      }),
    );
    expect(view).toMatchObject({ state: "ready", contents: [], failed: true });
  });

  // NOTE: 失敗した文書のコンテンツは、ほかの文書の失敗の種類や並び順によらず
  // 提示しない (最初の失敗だけを見ると、後ろの失敗を見落とす)
  test.each([
    [
      "ERR_ORIGINATOR_PROFILE_SET_INVALID",
      "ERR_CONTENT_ATTESTATION_SET_VERIFY_FAILED",
    ],
    [
      "ERR_CONTENT_ATTESTATION_SET_VERIFY_FAILED",
      "ERR_ORIGINATOR_PROFILE_SET_INVALID",
    ],
  ])(
    "サブフレームが %s と %s で失敗しても、成功したサブフレームのコンテンツだけを提示する",
    (first, second) => {
      const [a, b, c] = [
        subFrameOf("a", 1),
        subFrameOf("b", 2),
        subFrameOf("c", 3),
      ];
      const view = tabViewOf(
        1,
        subscribed({
          frames: [
            { frame: topFrame, entry: settled(topFrame, topDocument) },
            { frame: a, entry: settled(a, failure(first)) },
            { frame: b, entry: settled(b, failure(second)) },
            { frame: c, entry: settled(c, adDocument("urn:uuid:c")) },
          ],
          siteProfile: site(),
        }),
      );
      expect(keysOf(view)).toEqual([
        `${publisher}:urn:uuid:article`,
        `${advertiser}:urn:uuid:c`,
      ]);
      expect(view).toMatchObject({ failed: false });
    },
  );

  test("トップレベル文書が失敗していても、失敗したサブフレームのコンテンツは提示しない", () => {
    const view = tabViewOf(
      1,
      subscribed({
        frames: [
          {
            frame: topFrame,
            entry: settled(
              topFrame,
              failure("ERR_ORIGINATOR_PROFILE_SET_INVALID"),
            ),
          },
          {
            frame: subFrame,
            entry: settled(
              subFrame,
              failure("ERR_CONTENT_ATTESTATION_SET_VERIFY_FAILED"),
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

  test("結果が無効になったサブフレームのコンテンツは提示しない", () => {
    const [a, b] = [subFrameOf("a", 1), subFrameOf("b", 2)];
    const view = tabViewOf(
      1,
      subscribed({
        frames: [
          { frame: topFrame, entry: settled(topFrame, topDocument) },
          {
            frame: a,
            entry: invalidated(settled(a, adDocument("urn:uuid:a"))),
          },
          { frame: b, entry: settled(b, adDocument("urn:uuid:b")) },
        ],
        siteProfile: site(),
      }),
    );
    expect(keysOf(view)).toEqual([
      `${publisher}:urn:uuid:article`,
      `${advertiser}:urn:uuid:b`,
    ]);
  });

  test("レジストリの検証に失敗すれば、どのコンテンツも提示しない", () => {
    const code = "ERR_ORIGINATOR_PROFILE_SET_VERIFY_FAILED";
    const view = tabViewOf(
      1,
      subscribed({
        frames: [
          { frame: topFrame, entry: settled(topFrame, failure(code)) },
          { frame: subFrame, entry: settled(subFrame, failure(code)) },
        ],
        siteProfile: failure("ERR_SITE_PROFILE_VERIFY_FAILED"),
        registry: failure(code),
      }),
    );
    expect(view).toMatchObject({
      state: "ready",
      site: { state: "absent" },
      contents: [],
      failed: true,
    });
  });

  test("トップレベル文書に届かなければ、運営者もコンテンツも無いことを示す", () => {
    const unreachable: SubscribedTabVerification = { error: new Error() };
    expect(tabViewOf(1, unreachable)).toMatchObject({
      state: "ready",
      site: { state: "absent" },
      contents: [],
      failed: false,
    });
  });

  test("fenced frame の CA は提示しない", () => {
    const fenced = { ...subFrame, frameType: "fenced_frame" as const };
    const view = tabViewOf(
      1,
      subscribed({
        frames: [
          { frame: topFrame, entry: settled(topFrame, topDocument) },
          { frame: fenced, entry: settled(fenced, adDocument("urn:uuid:ad")) },
        ],
        siteProfile: site(),
      }),
    );
    expect(view.state === "ready" && view.contents).toHaveLength(1);
  });
});
