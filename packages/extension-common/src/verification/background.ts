import { deserializeIfError } from "@originator-profile/core";
import type { ContentAttestationSet } from "@originator-profile/model";
import {
  listInputDependencies,
  verifyDocument,
  verifyRegistry,
  type FetchIntegrityResult,
  type SecuringResult,
  type SharedOriginators,
  type VerificationTarget,
  type DocumentVerificationResult as VerifiedDocument,
  type VerifyIntegrity,
} from "@originator-profile/verify";
import { injectContentScripts } from "../content-script-injection";
import { toDocumentCredentials } from "../credentials/messaging";
import type { FrameCredentials } from "../credentials/types";
import {
  isSiteProfileFetchError,
  verifyFetchedWebsite,
} from "../site-profile/verify-website";
import { getAllFrames, getFrame } from "../utils/frames";
import { originOf } from "../utils/origin";
import { getRegistry } from "../utils/registry-ops";
import { verificationMessenger } from "./events";
import {
  dependsOnRenderedResult,
  invalidate,
  InvalidationType,
  isAllowedUrlConsistent,
  isReusable,
  isStillValid,
  toInputIdentity,
  VerificationIncomplete,
} from "./identity";
import {
  getRegistryEntry,
  getSiteProfileEntry,
  getVerificationEntry,
  listVerificationEntries,
  removeSiteProfileEntry,
  setRegistryEntry,
  setSiteProfileEntry,
  setVerificationEntry,
  trackDocument,
  untrackTab,
} from "./store";
import type {
  DocumentCredentials,
  DocumentVerificationResult,
  InputIdentity,
  RegistryEntry,
  SiteProfileEntry,
  VerificationEntry,
  VerificationSubject,
} from "./types";

type Destination = { tabId: number; frameId: number; documentId: string };

/** 検証を始めた契機 */
type Trigger = {
  /** bfcache から復元された */
  restored?: boolean;
  /** 保持している結果を再利用しない */
  force?: boolean;
};

/**
 * 保持している結果を再利用できるか
 *
 * bfcache から復元された文書の結果が rendered result に依存する場合は、
 * 改めて検証する。
 */
async function canReuse(
  documentId: string,
  current: InputIdentity,
  trigger: Trigger,
): Promise<boolean> {
  if (trigger.force) return false;
  const previous = await getVerificationEntry(documentId);
  if (trigger.restored && dependsOnRenderedResult(previous)) return false;
  return isReusable(previous, current, new Date());
}

/**
 * 保持する検証結果から、VC の原文を除く
 *
 * 復号したペイロードは outcome にあり、原文は表示に用いないため保持しない。
 */
function withoutSources<T extends { securingResults: SecuringResult[] }>(
  result: T,
): T {
  return {
    ...result,
    securingResults: result.securingResults.map(
      ({ source: _, ...rest }) => rest,
    ),
  };
}

/** 検証結果から、保持できない検証対象と VC の原文を除く */
function toStoredResult(
  result: VerifiedDocument<VerificationTarget>,
): DocumentVerificationResult {
  if (!result.outcome) return withoutSources(result);
  const { target: _, ...outcome } = result.outcome;
  return withoutSources({ ...result, outcome });
}

/** 保持するクレデンシャル。原文を除き、取得経路だけを残す */
const toStoredCredentials = ({
  ops,
  cas,
  opMeta,
}: Pick<FrameCredentials, "ops" | "cas" | "opMeta">): DocumentCredentials => ({
  ops: ops.map(({ source }) => ({ source })),
  cas: cas.map(({ source }) => ({ source })),
  opMeta,
});

/**
 * クレデンシャルのない文書の結果
 *
 * 検証の対象がないため検証しない。レジストリの検証結果を文書ごとに保持しない。
 */
const emptyResult = (url: string): DocumentVerificationResult => ({
  status: true,
  outcome: { originators: [], cas: [] },
  securingResults: [],
  warnings: [],
  info: [],
  verifiedAt: new Date().toISOString(),
  scope: [],
  inputRange: [{ kind: "document", url }],
});

/** 検証を完了できなかった文書の結果。表示が確定しないまま残らないようにする */
const incompleteEntry = (
  subject: VerificationSubject,
  error: unknown,
): VerificationEntry => ({
  state: "settled",
  subject,
  credentials: { ops: [], cas: [] },
  inputIdentity: { cas: [], ops: [], targets: [], evaluatedUrl: subject.url },
  result: {
    status: false,
    securingResults: [],
    warnings: [],
    info: [],
    errors: [
      {
        type: VerificationIncomplete,
        title: "Verification could not be completed",
        detail: error instanceof Error ? error.message : String(error),
      },
    ],
    verifiedAt: new Date().toISOString(),
    scope: [],
    inputRange: [],
  },
});

/** 文書内の Target Integrity 検証器 */
const DocumentIntegrityVerifier =
  ({ tabId, frameId, documentId }: Destination): VerifyIntegrity =>
  async (content) =>
    deserializeIfError(
      await verificationMessenger.sendMessage(
        "verifyDocumentIntegrity",
        { documentId, content },
        { tabId, frameId },
      ),
    ) as FetchIntegrityResult;

/** CAS の target が依存する入力が、すべて検証可能になる時点まで待つ */
async function awaitInputDependencies(
  { tabId, frameId, documentId }: Destination,
  cas: ContentAttestationSet,
) {
  const dependencies = new Set(
    listInputDependencies(cas).map(({ dependency }) => dependency),
  );
  await Promise.all(
    [...dependencies].map((dependency) =>
      verificationMessenger.sendMessage(
        "awaitInputDependency",
        { documentId, dependency },
        { tabId, frameId },
      ),
    ),
  );
}

/**
 * 文書の検証に用いる共有の発信者
 *
 * トップレベル文書では、そのオリジンの Web サイトの検証結果も用いる。Site Profile
 * が設置されていなければ用いない。Site Profile の検証に失敗していれば、その結果を
 * 渡して文書も失敗にする。
 */
const sharedOriginatorsOf = (
  registry: SharedOriginators["registry"],
  site?: SiteProfileEntry,
): SharedOriginators =>
  site && !isSiteProfileFetchError(site.result.errors?.[0])
    ? { registry, site: site.result }
    : { registry };

/**
 * Service Worker の検証パイプラインを登録する
 *
 * 文書ごとに独立して、クレデンシャルの取得・入力依存対象の待ち合わせ・検証を
 * おこない、結果を検証結果ストアに書き込む。
 */
export function setupVerificationPipeline() {
  /** 文書ごとの検証の世代。新しい検証が始まったら古い検証の結果は書き込まない */
  const generations = new Map<string, number>();
  let lastGeneration = 0;
  /** 進行中のオリジンごとの Site Profile の検証 */
  const siteProfiles = new Map<string, Promise<SiteProfileEntry>>();
  /** 進行中のレジストリの検証 */
  let registryVerification: Promise<RegistryEntry> | undefined;
  /**
   * レジストリの検証結果。Service Worker が起動し直しても、検証結果ストアにある
   * 結果を再利用できるうちは検証し直さない
   */
  const verifiedRegistry = async (): Promise<RegistryEntry> => {
    const stored = await getRegistryEntry();
    if (stored && isStillValid(stored, new Date())) return stored;
    registryVerification ??= getRegistry()
      .then(async (registry) => {
        const entry = withoutSources(await verifyRegistry(registry));
        // NOTE: サイドパネルが発信者の並びと取得経路を組み立てるためにも読む
        await setRegistryEntry(entry);
        return entry;
      })
      .finally(() => {
        registryVerification = undefined;
      });
    return registryVerification;
  };

  /** 文書の新しい検証を始め、その検証がまだ最新かを判定する関数を返す */
  const startGeneration = (documentId: string) => {
    const generation = ++lastGeneration;
    generations.set(documentId, generation);
    return () => generations.get(documentId) === generation;
  };

  const forget = (documentIds: string[]) => {
    for (const id of documentIds) generations.delete(id);
  };

  /**
   * オリジンの Site Profile を検証する。同じオリジンの結果があれば再利用する
   * @param destination Site Profile を取得するトップレベル文書
   */
  const verifySiteProfile = (destination: Destination, origin: string) => {
    const { tabId, frameId, documentId } = destination;
    const pending = siteProfiles.get(origin);
    if (pending) return pending;

    const verifying = (async () => {
      const stored = await getSiteProfileEntry(origin);
      if (stored && isStillValid(stored.result, new Date())) return stored;

      const registry = await verifiedRegistry();
      const verification = await verifyFetchedWebsite(
        async () => {
          const result = deserializeIfError(
            await verificationMessenger.sendMessage(
              "fetchDocumentSiteProfile",
              { documentId },
              { tabId, frameId },
            ),
          );
          if (result instanceof Error) throw result;
          return result;
        },
        { verifiedRegistry: registry },
      );
      const entry = { origin, result: withoutSources(verification) };
      await setSiteProfileEntry(entry);
      return entry;
    })().finally(() => siteProfiles.delete(origin));
    siteProfiles.set(origin, verifying);
    return verifying;
  };

  /**
   * 文書を検証して結果を書き込む
   * @param subject 検証対象の文書の識別。取得したクレデンシャルの URL で更新する
   */
  const verifyDocumentOf = async (
    destination: Destination,
    subject: VerificationSubject,
    trigger: Trigger,
    isCurrent: () => boolean,
  ) => {
    const { tabId, frameId, documentId } = destination;
    const isTopLevel = subject.frameType === "outermost_frame";
    // NOTE: 失敗は、文書の検証で結果を待つときに扱う
    if (isTopLevel) {
      verifySiteProfile(destination, subject.origin).catch(() => {});
    }

    const response = await verificationMessenger.sendMessage(
      "fetchDocumentCredentials",
      { documentId },
      { tabId, frameId },
    );
    const { ops, cas, opMeta, url, origin } = toDocumentCredentials(response);
    Object.assign(subject, { url, origin });
    const inputIdentity = await toInputIdentity({ ops, cas }, url);
    if (await canReuse(documentId, inputIdentity, trigger)) return;
    if (!isCurrent()) return;

    if (!isTopLevel && ops.length === 0 && cas.length === 0) {
      await setVerificationEntry({
        state: "settled",
        subject,
        credentials: toStoredCredentials({ ops, cas, opMeta }),
        result: emptyResult(url),
        inputIdentity,
      });
      return;
    }

    await setVerificationEntry({ state: "unverified", subject });

    const credentials = {
      ops: ops.map(({ credential }) => credential),
      cas: cas.map(({ credential }) => credential),
    };
    await awaitInputDependencies(destination, credentials.cas);

    if (!isCurrent()) return;
    await setVerificationEntry({
      state: "verifying",
      subject,
      startedAt: new Date().toISOString(),
    });

    const [registry, registryResult, site] = await Promise.all([
      getRegistry(),
      verifiedRegistry(),
      isTopLevel ? verifySiteProfile(destination, subject.origin) : undefined,
    ]);
    const result = await verifyDocument(
      {
        ...credentials,
        url,
        frameType: subject.frameType,
        verifyIntegrity: DocumentIntegrityVerifier(destination),
      },
      { registry, shared: sharedOriginatorsOf(registryResult, site) },
    );

    if (!isCurrent()) return;
    await setVerificationEntry({
      state: "settled",
      subject,
      credentials: toStoredCredentials({ ops, cas, opMeta }),
      result: toStoredResult(result),
      inputIdentity,
    });
  };

  const verifyFrameDocument = async (
    destination: Destination,
    trigger: Trigger,
  ) => {
    const { tabId, frameId, documentId } = destination;
    const frame = await getFrame({ tabId, frameId, documentId });
    if (!frame) return;

    forget(
      await trackDocument(tabId, frameId, documentId, originOf(frame.url)),
    );
    const isCurrent = startGeneration(documentId);
    const subject: VerificationSubject = {
      tabId,
      frameId,
      parentFrameId: frame.parentFrameId,
      documentId,
      frameType: frame.frameType,
      url: frame.url,
      origin: originOf(frame.url),
    };

    try {
      await verifyDocumentOf(destination, subject, trigger, isCurrent);
    } catch (error) {
      // NOTE: 検証のあいだに文書が入れ替わったかフレームが取り除かれると、文書への
      // 要求が拒否されるか届かずに失敗する。いずれも想定内のため打ち切るだけにする
      const current = await chrome.webNavigation
        .getFrame({ tabId, frameId })
        .catch(() => null);
      if (!isCurrent() || current?.documentId !== documentId) return;
      console.error(
        `[verification] Failed to verify document ${documentId}:`,
        error,
      );
      await setVerificationEntry(incompleteEntry(subject, error));
    }
  };

  const run = (destination: Destination, trigger: Trigger = {}) => {
    verifyFrameDocument(destination, trigger).catch((error: unknown) => {
      console.error(
        `[verification] Failed to verify document ${destination.documentId}:`,
        error,
      );
    });
  };

  verificationMessenger.onMessage(
    "register",
    ({ sender }) => (sender as chrome.runtime.MessageSender).documentId,
  );

  /** メッセージの送り主の文書 */
  const destinationOf = (sender: unknown): Destination | undefined => {
    // NOTE: webextension-polyfill の型定義は documentId を持たない
    const { tab, frameId, documentId } = sender as chrome.runtime.MessageSender;
    if (tab?.id === undefined || frameId === undefined || !documentId) return;
    return { tabId: tab.id, frameId, documentId };
  };

  verificationMessenger.onMessage("documentChanged", ({ data, sender }) => {
    const destination = destinationOf(sender);
    if (destination) run(destination, data);
  });

  verificationMessenger.onMessage("inputChanged", ({ sender }) => {
    const destination = destinationOf(sender);
    if (destination) run(destination, { force: true });
  });

  /** same-document navigation で allowedUrl の評価結果が変われば結果を無効にする */
  const reevaluateAllowedUrl = async ({
    documentId,
    url,
  }: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
    if (!documentId) return;
    const entry = await getVerificationEntry(documentId);
    if (entry?.state !== "settled") return;
    if (await isAllowedUrlConsistent(entry, url)) return;
    await setVerificationEntry(
      invalidate(
        entry,
        {
          type: InvalidationType.AllowedUrlChanged,
          title: "allowedUrl no longer matches the document URL",
        },
        new Date(),
      ),
    );
  };
  chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    void reevaluateAllowedUrl(details);
  });
  chrome.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
    void reevaluateAllowedUrl(details);
  });

  verificationMessenger.onMessage(
    "verifyTab",
    async ({ data: { tabId, force } }) => {
      const frames = await getAllFrames(tabId);
      if (force) {
        const top = frames.find(
          ({ frameType }) => frameType === "outermost_frame",
        );
        if (top) await removeSiteProfileEntry(originOf(top.url));
      }
      const resync = (targets: typeof frames) =>
        Promise.all(
          targets.map(({ frameId, documentId }) =>
            verificationMessenger
              .sendMessage("resync", { documentId, force }, { tabId, frameId })
              .then(
                () => true,
                () => false,
              ),
          ),
        );
      const reached = await resync(frames);
      const { status } = await chrome.tabs.get(tabId);
      const loading = status === "loading";

      // NOTE: 読み込みを終えても応えない文書には content script が入っていない
      // (拡張機能の起動と文書の読み込みが重なった場合など)。注入して求め直す
      const unreached = frames.filter((_, i) => !reached[i]);
      if (!loading && unreached.length > 0) {
        await injectContentScripts(
          tabId,
          unreached.map(({ frameId }) => frameId),
        );
        const retried = await resync(unreached);
        for (const [i, frame] of unreached.entries()) {
          reached[frames.indexOf(frame)] = retried[i] ?? false;
        }
      }

      return {
        reachable: frames.flatMap(({ documentId }, i) =>
          reached[i] ? [documentId] : [],
        ),
        loading,
      };
    },
  );

  chrome.tabs.onRemoved.addListener((tabId) => {
    void untrackTab(tabId).then(forget);
  });

  // NOTE: Service Worker が停止すると進行中の検証は失われる。確定していない
  // 文書に通知を求め、検証をやり直す。
  void listVerificationEntries().then((entries) => {
    for (const { state, subject } of entries) {
      if (state === "settled" || state === "invalidated") continue;
      verificationMessenger
        .sendMessage(
          "resync",
          { documentId: subject.documentId, force: false },
          { tabId: subject.tabId, frameId: subject.frameId },
        )
        .catch(() => {
          // 文書がすでに破棄されている
        });
    }
  });
}
