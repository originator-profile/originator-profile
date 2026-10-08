import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  documentKey,
  setSiteProfileEntry,
  setVerificationEntry,
  siteProfileKey,
  trackDocument,
  untrackTab,
} from "./store";
import type { VerificationEntry, VerificationSubject } from "./types";

type Frame = {
  tabId: number;
  frameId: number;
  documentId: string;
  documentLifecycle: chrome.extensionTypes.DocumentLifecycle;
};

/** chrome.storage.session と、文書の所在を問い合わせる API の代役 */
function fakeChrome({ quota = Infinity } = {}) {
  const storage = new Map<string, unknown>();
  const frames: Frame[] = [];
  const active = new Set<number>();
  const size = () =>
    [...storage].reduce(
      (n, [k, v]) => n + k.length + JSON.stringify(v).length,
      0,
    );

  vi.stubGlobal("chrome", {
    storage: {
      session: {
        get: async (keys: string | string[] | null) => {
          const wanted = keys === null ? [...storage.keys()] : [keys].flat();
          return Object.fromEntries(
            wanted.flatMap((k) =>
              storage.has(k) ? [[k, storage.get(k)]] : [],
            ),
          );
        },
        set: async (items: Record<string, unknown>) => {
          const previous = new Map(storage);
          for (const [k, v] of Object.entries(items)) storage.set(k, v);
          if (size() > quota) {
            storage.clear();
            for (const [k, v] of previous) storage.set(k, v);
            throw new Error(
              "Session storage quota bytes exceeded. Values were not stored.",
            );
          }
        },
        remove: async (keys: string | string[]) => {
          for (const k of [keys].flat()) storage.delete(k);
        },
      },
    },
    webNavigation: {
      getAllFrames: async ({ tabId }: { tabId: number }) =>
        frames.filter(
          (f) => f.tabId === tabId && f.documentLifecycle === "active",
        ),
      getFrame: async ({ documentId }: { documentId: string }) =>
        frames.find((f) => f.documentId === documentId) ?? null,
    },
    tabs: {
      query: async () => [...active].map((id) => ({ id })),
    },
  });

  return { storage, frames, active };
}

const subject = (
  tabId: number,
  frameId: number,
  documentId: string,
  frameType: chrome.extensionTypes.FrameType = frameId === 0
    ? "outermost_frame"
    : "sub_frame",
): VerificationSubject => ({
  tabId,
  frameId,
  parentFrameId: frameId === 0 ? -1 : 0,
  documentId,
  frameType,
  url: "https://www.example.org/",
  origin: "https://www.example.org",
});

const unverified = (s: VerificationSubject): VerificationEntry => ({
  state: "unverified",
  subject: s,
});

describe("trackDocument", () => {
  let fake: ReturnType<typeof fakeChrome>;
  beforeEach(() => {
    fake = fakeChrome();
  });

  test("取り除かれたフレームの文書の結果を破棄する", async () => {
    fake.frames.push(
      { tabId: 1, frameId: 0, documentId: "top", documentLifecycle: "active" },
      { tabId: 1, frameId: 1, documentId: "ad", documentLifecycle: "active" },
    );
    await trackDocument(1, 0, "top", "https://www.example.org");
    await trackDocument(1, 1, "ad", "https://www.example.org");
    await setVerificationEntry(unverified(subject(1, 1, "ad")));

    // 広告の iframe が取り除かれ、別の iframe が挿入された
    fake.frames.splice(1, 1, {
      tabId: 1,
      frameId: 2,
      documentId: "next",
      documentLifecycle: "active",
    });
    const removed = await trackDocument(
      1,
      2,
      "next",
      "https://www.example.org",
    );

    expect(removed).toEqual(["ad"]);
    expect(fake.storage.has(documentKey("ad"))).toBe(false);
  });

  test("bfcache にあるトップレベル文書の結果は残す", async () => {
    fake.frames.push({
      tabId: 1,
      frameId: 0,
      documentId: "before",
      documentLifecycle: "active",
    });
    await trackDocument(1, 0, "before", "https://www.example.org");
    await setVerificationEntry(unverified(subject(1, 0, "before")));

    fake.frames[0].documentLifecycle = "cached";
    fake.frames.push({
      tabId: 1,
      frameId: 0,
      documentId: "after",
      documentLifecycle: "active",
    });
    const removed = await trackDocument(
      1,
      0,
      "after",
      "https://www.example.org",
    );

    expect(removed).toEqual([]);
    expect(fake.storage.has(documentKey("before"))).toBe(true);
  });

  test("bfcache にあってもサブフレームの文書の結果は残さない", async () => {
    fake.frames.push(
      { tabId: 1, frameId: 0, documentId: "top", documentLifecycle: "active" },
      { tabId: 1, frameId: 1, documentId: "a", documentLifecycle: "active" },
    );
    await trackDocument(1, 0, "top", "https://www.example.org");
    await trackDocument(1, 1, "a", "https://www.example.org");
    await setVerificationEntry(unverified(subject(1, 1, "a")));

    fake.frames[1].documentLifecycle = "cached";
    fake.frames.push({
      tabId: 1,
      frameId: 1,
      documentId: "b",
      documentLifecycle: "active",
    });
    const removed = await trackDocument(1, 1, "b", "https://www.example.org");

    expect(removed).toEqual(["a"]);
  });
});

describe("setVerificationEntry", () => {
  test("fenced frame の結果は保持しない", async () => {
    const fake = fakeChrome();
    fake.frames.push({
      tabId: 1,
      frameId: 3,
      documentId: "fenced",
      documentLifecycle: "active",
    });
    await trackDocument(1, 3, "fenced", "https://www.example.org");

    expect(
      await setVerificationEntry(
        unverified(subject(1, 3, "fenced", "fenced_frame")),
      ),
    ).toBe(false);
    expect(fake.storage.has(documentKey("fenced"))).toBe(false);
  });

  test("容量が足りなければ表示中でないタブのサブフレームから追い出す", async () => {
    const fake = fakeChrome({ quota: 1_500 });
    fake.active.add(1);
    const padding = "x".repeat(200);
    const padded = (s: VerificationSubject): VerificationEntry => ({
      state: "unverified",
      subject: { ...s, url: padding },
    });
    fake.frames.push(
      {
        tabId: 1,
        frameId: 0,
        documentId: "shown",
        documentLifecycle: "active",
      },
      {
        tabId: 2,
        frameId: 0,
        documentId: "hidden",
        documentLifecycle: "active",
      },
      { tabId: 2, frameId: 1, documentId: "ad", documentLifecycle: "active" },
      { tabId: 1, frameId: 1, documentId: "new", documentLifecycle: "active" },
    );
    // NOTE: trackDocument は直列化されるため、呼び出した順に記録される
    await Promise.all(
      (
        [
          [1, 0, "shown"],
          [2, 0, "hidden"],
          [2, 1, "ad"],
          [1, 1, "new"],
        ] as const
      ).map(([tabId, frameId, documentId]) =>
        trackDocument(tabId, frameId, documentId, "https://www.example.org"),
      ),
    );
    await setVerificationEntry(padded(subject(1, 0, "shown")));
    await setVerificationEntry(padded(subject(2, 0, "hidden")));
    await setVerificationEntry(padded(subject(2, 1, "ad")));

    expect(await setVerificationEntry(padded(subject(1, 1, "new")))).toBe(true);
    expect(fake.storage.has(documentKey("ad"))).toBe(false);
    expect(fake.storage.has(documentKey("hidden"))).toBe(true);
    expect(fake.storage.has(documentKey("shown"))).toBe(true);
  });
});

describe("untrackTab", () => {
  test("タブの文書の結果をすべて破棄する", async () => {
    const fake = fakeChrome();
    fake.frames.push({
      tabId: 1,
      frameId: 0,
      documentId: "top",
      documentLifecycle: "active",
    });
    await trackDocument(1, 0, "top", "https://www.example.org");
    await setVerificationEntry(unverified(subject(1, 0, "top")));

    expect(await untrackTab(1)).toEqual(["top"]);
    expect(fake.storage.size).toBe(0);
  });
});

describe("Site Profile の検証結果", () => {
  const origin = "https://www.example.org";
  const entry = {
    state: "settled" as const,
    origin,
    result: {
      status: false as const,
      securingResults: [],
      warnings: [],
      info: [],
      errors: [],
      verifiedAt: "2026-10-08T00:00:00.000Z",
      scope: [],
      inputRange: [],
    },
  };

  test("同じオリジンのトップレベル文書が残っているあいだは保持する", async () => {
    const fake = fakeChrome();
    fake.frames.push(
      { tabId: 1, frameId: 0, documentId: "a", documentLifecycle: "active" },
      { tabId: 2, frameId: 0, documentId: "b", documentLifecycle: "active" },
    );
    await trackDocument(1, 0, "a", origin);
    await trackDocument(2, 0, "b", origin);
    await setSiteProfileEntry(entry);

    await untrackTab(1);
    expect(fake.storage.has(siteProfileKey(origin))).toBe(true);

    await untrackTab(2);
    expect(fake.storage.has(siteProfileKey(origin))).toBe(false);
  });

  test("別のオリジンへ遷移したら、使われなくなったオリジンの結果を破棄する", async () => {
    const fake = fakeChrome();
    fake.frames.push({
      tabId: 1,
      frameId: 0,
      documentId: "a",
      documentLifecycle: "active",
    });
    await trackDocument(1, 0, "a", origin);
    await setSiteProfileEntry(entry);

    fake.frames.splice(0, 1, {
      tabId: 1,
      frameId: 0,
      documentId: "b",
      documentLifecycle: "active",
    });
    await trackDocument(1, 0, "b", "https://other.example.com");

    expect(fake.storage.has(siteProfileKey(origin))).toBe(false);
  });
});
