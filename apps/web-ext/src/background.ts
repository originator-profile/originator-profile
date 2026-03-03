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

import {
  allowNavigation,
  cleanupNavigationState,
  consumeAllowedNavigation,
  normalizeUrl,
} from "./utils/navigation-state";

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

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") return;

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

const pendingOpIdVerification = new PersistentMap<{
  targetOpId: string;
  sourceOrgName?: string;
  expectedOrgName?: string;
  warnedUrl?: string;
}>("pendingOpIdVerification");

const verificationResults = new PersistentMap<LinkVerificationResult>(
  "verificationResults",
);

const verificationCache = new PersistentMap<{
  [url: string]: LinkVerificationResult;
}>("verificationCache");

const pendingClicks = new PersistentMap<{
  [frameId: number]: {
    targetOpId: string;
    sourceOrgName?: string;
    expectedOrgName?: string;
  };
}>("pendingClicks");

const pendingNewTabAssociations = new PersistentMap<{
  [frameId: number]: number[];
}>("pendingNewTabAssociations");

const stateReady = Promise.all([
  pendingOpIdVerification.load(),
  verificationResults.load(),
  verificationCache.load(),
  pendingClicks.load(),
  pendingNewTabAssociations.load(),
]);

// Clean up state when a tab is closed to prevent memory leaks
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await stateReady;
  pendingOpIdVerification.delete(tabId);
  verificationResults.delete(tabId);
  verificationCache.delete(tabId);
  pendingClicks.delete(tabId);
  pendingNewTabAssociations.delete(tabId);
  cleanupNavigationState(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "allowNavigation") {
    if (sender.tab?.id) {
      allowNavigation(sender.tab.id, message.url);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, reason: "no tab id" });
    }
    return;
  }
  return false;
});

// Use webNavigation to correctly associate new tabs with the specific frame that opened them
chrome.webNavigation.onCreatedNavigationTarget.addListener(async (details) => {
  await stateReady;
  const { sourceTabId, sourceFrameId, tabId } = details;
  // If we already have a pending click from this source frame, associate it immediately
  const sourcePendingClicks = pendingClicks.get(sourceTabId);
  if (sourcePendingClicks?.[sourceFrameId]) {
    const pendingClick = sourcePendingClicks[sourceFrameId];
    pendingOpIdVerification.set(tabId, pendingClick);

    // Clear from source tab if it had the exact same verification (consumed by new tab)
    const currentMainPending = pendingOpIdVerification.get(sourceTabId);
    if (
      currentMainPending &&
      currentMainPending.targetOpId === pendingClick.targetOpId
    ) {
      pendingOpIdVerification.delete(sourceTabId);
    }
  } else {
    // Otherwise, store usage association for when the click message arrives
    pendingNewTabAssociations.update(sourceTabId, (current) => {
      const next = current || {};
      if (!next[sourceFrameId]) {
        next[sourceFrameId] = [];
      }
      next[sourceFrameId].push(tabId);
      return next;
    });
  }
});

// Propagate verification state to new tabs opened via window.open (Legacy/Fallback)
chrome.tabs.onCreated.addListener(async (tab) => {
  await stateReady;
  const openerId = tab.openerTabId;
  if (openerId !== undefined) {
    const pending = pendingOpIdVerification.get(openerId);
    // Only inherit if we haven't already set it via onCreatedNavigationTarget (which is more precise)
    if (
      pending &&
      tab.id !== undefined &&
      !pendingOpIdVerification.get(tab.id)
    ) {
      pendingOpIdVerification.set(tab.id, pending);
    }
  }
});

const handleAdClicked = (
  tabId: number,
  frameId: number,
  targetOpId: string,
  sourceOrgName?: string,
  expectedOrgName?: string,
  isNewTab?: boolean,
) => {
  // Store the click for this frame
  pendingClicks.update(tabId, (current) => {
    const next = current || {};
    next[frameId] = {
      targetOpId,
      sourceOrgName,
      expectedOrgName,
    };
    return next;
  });

  // Only update main pending map if it's not explicitly a new-tab click
  // (Prevents source tab from showing verification warnings if it simultaneously navigates)
  if (!isNewTab) {
    pendingOpIdVerification.set(tabId, {
      targetOpId,
      sourceOrgName,
      expectedOrgName,
    });
  }

  // Check if any new tabs were already created by this frame waiting for this opId
  const tabAssociations = pendingNewTabAssociations.get(tabId);
  const waitingTabs = tabAssociations?.[frameId];

  if (tabAssociations && waitingTabs) {
    for (const newTabId of waitingTabs) {
      pendingOpIdVerification.set(newTabId, {
        targetOpId,
        sourceOrgName,
        expectedOrgName,
      });
    }
    // Clear associations as they are fulfilled
    delete tabAssociations[frameId];
    pendingNewTabAssociations.set(tabId, tabAssociations);

    // If a new tab consumed this click, ensure we clear it from the source tab
    const currentMainPending = pendingOpIdVerification.get(tabId);
    if (waitingTabs.length > 0 && currentMainPending?.targetOpId === targetOpId) {
      pendingOpIdVerification.delete(tabId);
    }
  }
};

credentialsMessenger.onMessage("adClicked", async ({ data, sender }) => {
  await stateReady;
  if (sender.tab?.id && sender.frameId !== undefined) {
    handleAdClicked(
      sender.tab.id,
      sender.frameId,
      data.targetopid,
      data.sourceOrgName,
      data.expectedOrgName,
      data.isNewTab,
    );
  }
});

credentialsMessenger.onMessage(
  "getVerificationResult",
  async ({ data: tabId }) => {
    await stateReady;
    return verificationResults.get(tabId) ?? { status: "none" };
  },
);

const executeWarningRedirect = (
  tabId: number,
  url: string,
  reason: string,
  sourceOrg?: string,
  destOrg?: string,
  expectedOrg?: string,
) => {
  const params = new URLSearchParams({
    target: url,
    reason,
  });
  if (sourceOrg) params.append("sourceOrg", sourceOrg);
  if (destOrg) params.append("destOrg", destOrg);
  if (expectedOrg) params.append("expectedOrg", expectedOrg);

  const warningUrl = `${chrome.runtime.getURL("index.html")}#/warning?${params.toString()}`;
  void chrome.scripting.executeScript({
    target: { tabId },
    func: (destination) => {
      const referrer = document.referrer;
      const fullUrl =
        destination +
        (referrer ? `&original=${encodeURIComponent(referrer)}` : "");
      window.location.replace(fullUrl);
    },
    args: [warningUrl],
  });
};

const createErrorResult = (
  targetOpId: string,
  sourceOrgName: string | undefined,
  expectedOrgName: string | undefined,
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
  // Handle both 'sites' (new) and 'credential' (legacy)
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
  // WSP name fallback
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
  // Find WSP that matches targetOpId
  const matchedWsp = decodedWsps.find((wsp) => wsp.doc.issuer === targetOpId);

  if (matchedWsp) {
    return resolveName(matchedWsp, decodedOps);
  }

  // Fallback: If no match, try to get name from first available WSP
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

const createMismatchResult = (
  targetOpId: string,
  sourceOrgName: string | undefined,
  expectedOrgName: string | undefined,
  destinationOrgName: string | undefined,
  isMissing: boolean,
): LinkVerificationResult => {
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

const getVerificationResult = async (
  tabId: number,
  targetOpId: string,
  sourceOrgName?: string,
  expectedOrgName?: string,
): Promise<LinkVerificationResult> => {
  try {
    const { ops, sp } = await fetchTabCredentials(tabId);
    const decodedOps = decodeOps(ops);
    const decodedWsps = decodeWsps(sp);

    if (decodedOps instanceof Error) {
      return createErrorResult(
        targetOpId,
        sourceOrgName,
        expectedOrgName,
        decodedOps,
      );
    }

    // Note: We don't strictly error if SP is invalid here, just treat as mismatch/missing.
    // Or should we? The original code didn't check WMP validity deeply beyond decodeOps return.

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
    return createMismatchResult(
      targetOpId,
      sourceOrgName,
      expectedOrgName,
      destinationOrgName,
      isMissing,
    );
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

const handleVerification = async (
  tabId: number,
  url: string,
  targetOpId: string,
  sourceOrgName?: string,
  expectedOrgName?: string,
) => {
  // Check if user allowed this destination.
  const isAllowed = await consumeAllowedNavigation(tabId, url);
  const result = await getVerificationResult(
    tabId,
    targetOpId,
    sourceOrgName,
    expectedOrgName,
  );
  verificationResults.set(tabId, result);

  // Cache the result for history navigation
  verificationCache.update(tabId, (current) => {
    const next = current || {};
    next[url] = result;
    return next;
  });

  if (result.status !== "matched" && !isAllowed) {
    const reason = result.reason ?? "Unknown Error";
    executeWarningRedirect(
      tabId,
      url,
      reason,
      result.sourceOrgName,
      result.destinationOrgName,
      result.expectedOrgName,
    );
    // 警告を出したURLを記録し、ユーザーが手動で別のURLへ移動した際にpendingを解除できるようにする
    const current = pendingOpIdVerification.get(tabId);
    if (current) {
      pendingOpIdVerification.set(tabId, { ...current, warnedUrl: url });
    }
    return;
  }

  pendingOpIdVerification.delete(tabId);
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
    console.error(
      details.transitionType,
      "isFromAddressBar [webNavigation.onCommitted] url:",
      details.url,
      "pendingExists:",
      !!pendingOpIdVerification.get(details.tabId),
    );
    return;
  }

  // typedやgenerated（外部アプリからのリンク等含む）でも、
  // リダイレクト（window.open() 等で付与されることが多い）を伴わない場合は手動遷移とみなしてキャンセル
  if (isTypedOrGenerated && !isClientRedirect && !isServerRedirect) {
    pendingOpIdVerification.delete(details.tabId);
    console.error(
      "isTypedOrGenerated [webNavigation.onCommitted] url:",
      details.url,
      "pendingExists:",
      !!pendingOpIdVerification.get(details.tabId),
    );
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

    await handleVerification(
      details.tabId,
      details.url,
      pending.targetOpId,
      pending.sourceOrgName,
      pending.expectedOrgName,
    );
  } else {
    // If no pending verification (e.g. Back/Forward navigation), try to restore from cache
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

// https://www.typescriptlang.org/tsconfig#non-module-files
export { };

// NOTE: gh-1583
if (import.meta.env.MODE === "development") {
  chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install") {
      void chrome.tabs.reload();
    }
  });
}

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
