import { SiteProfile, WebsiteProfile } from "@originator-profile/model";
import { JwtVcDecoder } from "@originator-profile/securing-mechanism";
import { DecodedOp, decodeOps } from "@originator-profile/verify";
import { fetchTabCredentials } from "./components/credentials";
import { credentialsMessenger } from "./components/credentials/events";
import { LinkVerificationResult } from "./components/credentials/types";
import { frameCasExtensionMessenger } from "./components/frameCas";
import { updateBadge, verifyTabCredentials } from "./components/tabBadge";
import "./utils/cors-basic-auth";

import { PersistentMap } from "./utils/persistent-map";

import { normalizeUrl } from "./utils/navigation-state";
import {
  type WarningSearchParams,
  buildWarningSearchParams,
} from "./utils/warning-params";

const windowSize = {
  width: 520,
  height: 640,
} as const;

/** バッジ更新のデバウンス時間（ミリ秒） */
const BADGE_UPDATE_DEBOUNCE_MS = 300;

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined) return;
  const url = `${chrome.runtime.getURL("index.html")}#/tab/${tab.id}`;
  await chrome.windows.create({ url, type: "popup", ...windowSize });
});

/**
 * タブのバッジを更新する
 * @param tabId タブID
 */
async function updateTabBadge(tabId: number): Promise<void> {
  try {
    const result = await verifyTabCredentials(tabId);
    await updateBadge(tabId, result?.count ?? 0);
  } catch (error) {
    console.error(
      `[updateTabBadge] Failed to update badge for tab ${tabId}:`,
      error,
    );
  }
}

// デバウンス用のタイマーID（タブIDごとに管理）
const pendingBadgeUpdateTimers = new Map<
  number,
  ReturnType<typeof setTimeout>
>();

/**
 * タブのバッジ更新をデバウンス付きで要求する
 * @param tabId タブID
 */
function requestTabBadgeUpdate(tabId: number): void {
  const existingTimer = pendingBadgeUpdateTimers.get(tabId);
  if (existingTimer !== undefined) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    pendingBadgeUpdateTimers.delete(tabId);
    void updateTabBadge(tabId);
  }, BADGE_UPDATE_DEBOUNCE_MS);

  pendingBadgeUpdateTimers.set(tabId, timer);
}

// タブ切り替え時にバッジを更新
chrome.tabs.onActivated.addListener(({ tabId }) => {
  requestTabBadgeUpdate(tabId);
});

// ページ遷移完了時にバッジを更新（アクティブタブのみ）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    requestTabBadgeUpdate(tabId);
  }
});

// タブ削除時にデバウンスタイマーをクリーンアップ
chrome.tabs.onRemoved.addListener((tabId) => {
  const timer = pendingBadgeUpdateTimers.get(tabId);
  if (timer !== undefined) {
    clearTimeout(timer);
    pendingBadgeUpdateTimers.delete(tabId);
  }
});

// 既存タブにContent Scriptを注入
async function injectContentScriptsToExistingTabs(): Promise<void> {
  const manifest = chrome.runtime.getManifest();
  const tabs = await chrome.tabs.query({});
  const injectableTabs = tabs.filter(
    (tab): tab is chrome.tabs.Tab & { id: number } =>
      tab.id !== undefined &&
      tab.url !== undefined &&
      /^https?:\/\//.test(tab.url),
  );

  const injections = (manifest.content_scripts ?? []).flatMap((cs) => {
    const files = cs.js;
    if (!files || files.length === 0) return [];

    return injectableTabs.map((tab) =>
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id, allFrames: cs.all_frames },
          files,
        })
        .catch(() => {
          // 注入できないページはスキップ
        }),
    );
  });

  await Promise.all(injections);
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") return;

  await injectContentScriptsToExistingTabs();

  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (activeTab?.id !== undefined) {
    requestTabBadgeUpdate(activeTab.id);
  }

  const granted = await chrome.permissions.contains({
    origins: ["<all_urls>"],
  });

  if (!granted) {
    // 権限が足らない場合は初期設定の説明を開く (Firefoxのみ)
    await chrome.tabs.create({
      url: "https://cip.docs.originator-profile.org/web-ext/experimental-use/#setup-in-firefox",
    });

    // NOTE: "<all_urls>" 権限求められないようなのでコメントアウト
    // const granted = await chrome.permissions.request({
    //   origins: ["<all_urls>"],
    // });
  }
});

/** 広告リンク検証の共通コンテキスト情報 */
interface VerificationContext {
  /** 検証対象の Originator Profile ID */
  targetOpId: string;
  /** 広告元の組織名 */
  sourceOrgName?: string;
  /** 期待される組織名 */
  expectedOrgName?: string;
}

/** {@link handleAdClicked} の引数 */
interface HandleAdClickedParams extends VerificationContext {
  /** 対象タブID */
  tabId: number;
  /** 新規タブで開かれたクリックか */
  isNewTab?: boolean;
  /** 広告元ページのURL */
  sourceUrl?: string;
}

/** {@link executeWarningRedirect} の引数 */
interface ExecuteWarningRedirectParams extends WarningSearchParams {
  /** リダイレクト対象のタブID */
  tabId: number;
}

/** {@link handleVerification} の引数 */
interface HandleVerificationParams extends VerificationContext {
  /** 検証対象のタブID */
  tabId: number;
  /** 検証対象のURL */
  url: string;
  /** 広告元のURL */
  sourceUrl?: string;
  /** 新規タブからの遷移か */
  isNewTab?: boolean;
}

/** {@link createMismatchResult} の引数 */
interface CreateMismatchResultParams extends VerificationContext {
  /** 遷移先の組織名 */
  destinationOrgName?: string;
  /** OPID未設定か（不一致ではなく） */
  isMissing: boolean;
}

const pendingOpIdVerification = new PersistentMap<{
  targetOpId: string;
  sourceOrgName?: string;
  expectedOrgName?: string;
  warnedUrl?: string;
  sourceUrl?: string;
  isNewTab?: boolean;
}>("pendingOpIdVerification");

const verificationResults = new PersistentMap<LinkVerificationResult>(
  "verificationResults",
);

const verificationCache = new PersistentMap<{
  [url: string]: LinkVerificationResult;
}>("verificationCache");

const stateReady = Promise.all([
  pendingOpIdVerification.load(),
  verificationResults.load(),
  verificationCache.load(),
]);

// window.openや<a target="_blank">で開かれた新規タブを追跡（openerTabId → newTabId[]）
const recentlyOpenedTabs = new Map<number, number[]>();

// タブが閉じられたとき、メモリリーク防止のために状態をクリーンアップ
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await stateReady;
  pendingOpIdVerification.delete(tabId);
  verificationResults.delete(tabId);
  verificationCache.delete(tabId);
  recentlyOpenedTabs.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "clearPendingVerification") {
    // 送信元が拡張機能の Warning ページであることを検証
    const isFromExtension = sender.url?.startsWith(chrome.runtime.getURL(""));
    if (!isFromExtension) {
      sendResponse({ success: false, reason: "unauthorized sender" });
      return;
    }
    if (sender.tab?.id) {
      pendingOpIdVerification.delete(sender.tab.id);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, reason: "no tab id" });
    }
    return;
  }
  return false;
});

chrome.tabs.onCreated.addListener(async (tab) => {
  await stateReady;
  const openerId = tab.openerTabId;
  if (openerId !== undefined && tab.id !== undefined) {
    // opener → new tab のマッピングを記録（FIFOキューで複数クリック時の順序を維持）
    const existing = recentlyOpenedTabs.get(openerId) || [];
    existing.push(tab.id);
    recentlyOpenedTabs.set(openerId, existing);

    // 元タブに pendingOpIdVerification があれば即座にコピー（新規タブとしてマーク）
    const pending = pendingOpIdVerification.get(openerId);
    if (pending && !pendingOpIdVerification.get(tab.id)) {
      pendingOpIdVerification.set(tab.id, { ...pending, isNewTab: true });
    }
  }
});

/**
 * 広告クリックを処理し、検証情報をタブに紐付ける
 * @param params - 広告クリック情報
 */
const handleAdClicked = ({
  tabId,
  targetOpId,
  sourceOrgName,
  expectedOrgName,
  isNewTab,
  sourceUrl,
}: HandleAdClickedParams) => {
  // 新規タブでのクリックでなければ、元タブの検証状態を更新
  if (!isNewTab) {
    pendingOpIdVerification.set(tabId, {
      targetOpId,
      sourceOrgName,
      expectedOrgName,
      sourceUrl,
    });
    return;
  }

  // 新規タブへの検証情報引き渡し（openerTabId ベース）
  const openerTabs = recentlyOpenedTabs.get(tabId);
  if (!openerTabs || openerTabs.length === 0) return;

  // FIFOで消費（複数クリック時の順序を維持）
  const newTabId = openerTabs.shift();
  if (newTabId === undefined) return;
  if (openerTabs.length === 0) {
    recentlyOpenedTabs.delete(tabId);
  }
  pendingOpIdVerification.set(newTabId, {
    targetOpId,
    sourceOrgName,
    expectedOrgName,
    sourceUrl,
    isNewTab: true,
  });
  // 新規タブが既に読み込み完了している場合、onCompleted は既に通過済みなので
  // ここで即座に検証を実行する（レースコンディション対策）
  void chrome.tabs
    .get(newTabId)
    .then(async (tab) => {
      if (!pendingOpIdVerification.get(newTabId)) return;
      if (
        tab.status === "complete" &&
        tab.url &&
        !tab.url.startsWith(chrome.runtime.getURL(""))
      ) {
        // eslint-disable-next-line no-use-before-define
        await handleVerification({
          tabId: newTabId,
          url: tab.url,
          targetOpId,
          sourceOrgName,
          expectedOrgName,
          sourceUrl,
          isNewTab: true,
        });
      }
    })
    .catch(() => {
      // タブが既に閉じられている場合は無視
    });

  // 元タブ側の検証情報をクリア
  const currentMainPending = pendingOpIdVerification.get(tabId);
  if (currentMainPending?.targetOpId === targetOpId) {
    pendingOpIdVerification.delete(tabId);
  }
};

credentialsMessenger.onMessage("adClicked", async ({ data, sender }) => {
  await stateReady;
  if (sender.tab?.id) {
    handleAdClicked({
      tabId: sender.tab.id,
      targetOpId: data.targetopid,
      sourceOrgName: data.sourceOrgName,
      expectedOrgName: data.expectedOrgName,
      isNewTab: data.isNewTab,
      sourceUrl: sender.tab.url,
    });
  }
});

credentialsMessenger.onMessage(
  "getVerificationResult",
  async ({ data: tabId }) => {
    await stateReady;
    return (
      verificationResults.get(tabId) ??
      ({ status: "none" } satisfies LinkVerificationResult)
    );
  },
);

/**
 * 検証失敗時に警告ページへリダイレクトする
 * @param params - リダイレクト情報
 */
const executeWarningRedirect = ({
  tabId,
  ...warningParams
}: ExecuteWarningRedirectParams) => {
  const params = buildWarningSearchParams(warningParams);

  const warningUrl = `${chrome.runtime.getURL("index.html")}#/warning?${params.toString()}`;
  void chrome.scripting.executeScript({
    target: { tabId },
    func: (destination) => {
      window.location.replace(destination);
    },
    args: [warningUrl],
  });
};

/**
 * OP検証エラー時の結果オブジェクトを生成する
 * @param context - 検証コンテキスト
 * @param error - 発生したエラー
 */
const createErrorResult = (
  { targetOpId, sourceOrgName, expectedOrgName }: VerificationContext,
  error: Error,
): LinkVerificationResult => {
  return {
    status: "error",
    expectedOpId: targetOpId,
    sourceOrgName,
    expectedOrgName,
    reason:
      import.meta.env.MODE === "development"
        ? chrome.i18n.getMessage("Verification_InvalidOpsDetail", error.message)
        : chrome.i18n.getMessage("Verification_InvalidOps"),
  };
};

const decodeWsps = (sp: SiteProfile | null) => {
  if (!sp) return [];
  const decodeWsp = JwtVcDecoder<WebsiteProfile>();
  // 'sites'（新形式）と 'credential'（旧形式）の両方に対応
  const sources = sp.sites ?? (sp.credential ? [sp.credential] : []);
  return sources
    .map((jwt) => {
      const decoded = decodeWsp(jwt);
      return decoded instanceof Error ? null : decoded;
    })
    .filter((wsp): wsp is NonNullable<typeof wsp> => wsp !== null);
};

const getOrgNameFromOp = (op: DecodedOp): string | undefined => {
  if (!op.annotations) return undefined;
  const annotationWithName = op.annotations.find(
    (a) =>
      "name" in a.doc.credentialSubject &&
      typeof a.doc.credentialSubject.name === "string",
  );
  if (annotationWithName) {
    return (annotationWithName.doc.credentialSubject as { name: string }).name;
  }
  return undefined;
};

const resolveName = (
  wsp: NonNullable<ReturnType<typeof decodeWsps>[0]>,
  decodedOps: DecodedOp[],
): string | undefined => {
  const op = decodedOps.find(
    (o) => o.core.doc.credentialSubject.id === wsp.doc.issuer,
  );
  if (op) {
    const orgName = getOrgNameFromOp(op);
    if (orgName) return orgName;
  }
  // WSP名のフォールバック
  if ("name" in wsp.doc.credentialSubject) {
    return wsp.doc.credentialSubject.name;
  }
  return undefined;
};

const getDestinationOrgName = (
  decodedOps: DecodedOp[],
  decodedWsps: ReturnType<typeof decodeWsps>,
  targetOpId: string,
): string | undefined => {
  // targetOpIdに一致するWSPを検索
  const matchedWsp = decodedWsps.find((wsp) => wsp.doc.issuer === targetOpId);

  if (matchedWsp) {
    return resolveName(matchedWsp, decodedOps);
  }

  // フォールバック: 一致するものがなければ先頭のWSPから取得を試みる
  if (decodedWsps.length > 0) {
    const firstWsp = decodedWsps[0];
    if (firstWsp) {
      return resolveName(firstWsp, decodedOps);
    }
  }

  return undefined;
};

const isMatched = (
  decodedWsps: ReturnType<typeof decodeWsps>,
  targetOpId: string,
): boolean => {
  return decodedWsps.some((wsp) => wsp.doc.issuer === targetOpId);
};

/**
 * OPID不一致または未設定時の結果オブジェクトを生成する
 * @param params - 不一致結果の生成に必要な情報
 */
const createMismatchResult = ({
  targetOpId,
  sourceOrgName,
  expectedOrgName,
  destinationOrgName,
  isMissing,
}: CreateMismatchResultParams): LinkVerificationResult => {
  const reason = isMissing
    ? chrome.i18n.getMessage("Verification_OpidMissing")
    : chrome.i18n.getMessage("Verification_OpidMismatch");
  return {
    status: isMissing ? "missing_opid" : "mismatched",
    expectedOpId: targetOpId,
    sourceOrgName,
    expectedOrgName,
    destinationOrgName,
    reason,
  };
};

/**
 * タブのクレデンシャルを取得し、OPID検証結果を返す
 * @param tabId - 検証対象のタブID
 * @param context - 検証コンテキスト
 */
const getVerificationResult = async (
  tabId: number,
  context: VerificationContext,
): Promise<LinkVerificationResult> => {
  const { targetOpId, sourceOrgName, expectedOrgName } = context;
  try {
    const { ops, sp } = await fetchTabCredentials(tabId);
    const decodedOps = decodeOps(ops);
    const decodedWsps = decodeWsps(sp);

    if (decodedOps instanceof Error) {
      return createErrorResult(context, decodedOps);
    }

    // SPが不正な場合はエラーとせず、不一致/未設定として扱う

    const matched = isMatched(decodedWsps, targetOpId);

    const destinationOrgName = getDestinationOrgName(
      decodedOps,
      decodedWsps,
      targetOpId,
    );

    if (matched) {
      return {
        status: "matched",
        expectedOpId: targetOpId,
        sourceOrgName,
        expectedOrgName,
        destinationOrgName,
      };
    }

    const isMissing = decodedWsps.length === 0;
    return createMismatchResult({
      targetOpId,
      sourceOrgName,
      expectedOrgName,
      destinationOrgName,
      isMissing,
    });
  } catch (e: unknown) {
    const reason = chrome.i18n.getMessage("Verification_FetchFailed");
    return {
      status: "error",
      expectedOpId: targetOpId,
      sourceOrgName,
      expectedOrgName,
      reason,
    };
  }
};

// handleVerification の二重実行を防止するガード
const verificationInProgress = new Set<number>();

/**
 * ページ読み込み完了時にOPID検証を実行し、不一致の場合は警告ページへリダイレクトする
 * @param params - 検証に必要な情報
 */
const handleVerification = async ({
  tabId,
  url,
  targetOpId,
  sourceOrgName,
  expectedOrgName,
  sourceUrl,
  isNewTab,
}: HandleVerificationParams) => {
  if (verificationInProgress.has(tabId)) return;
  verificationInProgress.add(tabId);
  try {
    const context: VerificationContext = {
      targetOpId,
      sourceOrgName,
      expectedOrgName,
    };
    const result = await getVerificationResult(tabId, context);
    verificationResults.set(tabId, result);

    // 履歴ナビゲーション用に結果をキャッシュ
    verificationCache.update(tabId, (current) => {
      const next = current || {};
      next[url] = result;
      return next;
    });

    if (result.status !== "matched") {
      const reason = result.reason ?? "Unknown Error";
      executeWarningRedirect({
        tabId,
        target: url,
        reason,
        sourceOrg: result.sourceOrgName,
        destOrg: result.destinationOrgName,
        expectedOrg: result.expectedOrgName,
        original: sourceUrl,
        isNewTab,
      });
      // 警告を出したURLを記録し、ユーザーが手動で別のURLへ移動した際にpendingを解除できるようにする
      pendingOpIdVerification.set(tabId, {
        targetOpId,
        sourceOrgName,
        expectedOrgName,
        warnedUrl: url,
        sourceUrl,
        isNewTab,
      });
      return;
    }

    pendingOpIdVerification.delete(tabId);
  } finally {
    verificationInProgress.delete(tabId);
  }
};

const restoreVerificationFromCache = (tabId: number, url: string) => {
  const cached = verificationCache.get(tabId)?.[url];
  if (cached) {
    verificationResults.set(tabId, cached);
  }
};

chrome.webNavigation.onCommitted.addListener(async (details) => {
  await stateReady;
  if (details.frameId !== 0) return;

  const isFromAddressBar =
    details.transitionQualifiers.includes("from_address_bar");
  const isForwardBack = details.transitionQualifiers.includes("forward_back");
  const isBookmark = details.transitionType === "auto_bookmark";
  const isReload = details.transitionType === "reload";
  const isClientRedirect =
    details.transitionQualifiers.includes("client_redirect");
  const isServerRedirect =
    details.transitionQualifiers.includes("server_redirect");

  const isTypedOrGenerated = [
    "typed",
    "generated",
    "keyword",
    "keyword_generated",
  ].includes(details.transitionType);

  // 明示的な手動操作やリロードの場合はキャンセル
  if (isFromAddressBar || isForwardBack || isBookmark || isReload) {
    pendingOpIdVerification.delete(details.tabId);
    return;
  }

  // typedやgenerated（外部アプリからのリンク等含む）でも、
  // リダイレクト（window.open() 等で付与されることが多い）を伴わない場合は手動遷移とみなしてキャンセル
  if (isTypedOrGenerated && !isClientRedirect && !isServerRedirect) {
    pendingOpIdVerification.delete(details.tabId);
    return;
  }
});

chrome.webNavigation.onCompleted.addListener(async (details) => {
  await stateReady;
  if (details.frameId !== 0) return;
  if (details.url.startsWith(chrome.runtime.getURL(""))) return;

  // Navigate したら結果をリセット
  verificationResults.delete(details.tabId);

  const pending = pendingOpIdVerification.get(details.tabId);
  if (pending) {
    if (
      pending.warnedUrl &&
      normalizeUrl(pending.warnedUrl) !== normalizeUrl(details.url)
    ) {
      // 警告画面から別のURLへ手動ナビゲートした（または新規タブで別URLを開いた）場合は、検証フローを中止する
      pendingOpIdVerification.delete(details.tabId);
      restoreVerificationFromCache(details.tabId, details.url);
      return;
    }

    await handleVerification({
      tabId: details.tabId,
      url: details.url,
      targetOpId: pending.targetOpId,
      sourceOrgName: pending.sourceOrgName,
      expectedOrgName: pending.expectedOrgName,
      sourceUrl: pending.sourceUrl,
      isNewTab: pending.isNewTab,
    });
  } else {
    // 保留中の検証がない場合（戻る/進むなど）はキャッシュから復元
    restoreVerificationFromCache(details.tabId, details.url);
  }
});

// iframeのCAS位置情報をコンテンツスクリプトに配信
frameCasExtensionMessenger.onMessage("prepareLocate", ({ data }) => {
  const { tabId, framesCas } = data;
  const targetFramesCas = framesCas.filter(
    (frameCas) => frameCas.cas.length > 0,
  );
  for (const frameCas of targetFramesCas) {
    void frameCasExtensionMessenger.sendMessage(
      "locating",
      {
        frameCas,
        frames: framesCas.map(({ cas: _, ...frame }) => frame),
      },
      {
        tabId,
        frameId: frameCas.frameId,
      },
    );
  }
});

if (import.meta.env.BASIC_AUTH) {
  for (const credential of import.meta.env.BASIC_AUTH_CREDENTIALS) {
    chrome.webRequest.onAuthRequired.addListener(
      () => ({
        authCredentials: {
          username: credential.username,
          password: credential.password,
        },
      }),
      {
        urls:
          credential.domain === "localhost"
            ? [
                "http://localhost:8080/*",
                // Firefox のため
                "http://localhost/*",
              ]
            : [`https://${credential.domain}/*`],
      },
      ["blocking"],
    );
  }
}
