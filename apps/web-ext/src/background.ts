import { WebMediaProfile } from "@originator-profile/model";
import { decodeOps } from "@originator-profile/verify";
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
    }
  }
});

// Use webNavigation to correctly associate new tabs with the specific frame that opened them
chrome.webNavigation.onCreatedNavigationTarget.addListener(async (details) => {
  await stateReady;
  const { sourceTabId, sourceFrameId, tabId } = details;
  // If we already have a pending click from this source frame, associate it immediately
  const sourcePendingClicks = pendingClicks.get(sourceTabId);
  if (sourcePendingClicks?.[sourceFrameId]) {
    pendingOpIdVerification.set(tabId, sourcePendingClicks[sourceFrameId]);
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
    if (pending && tab.id !== undefined && !pendingOpIdVerification.get(tab.id)) {
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

  // Also update main pending map for same-tab navigations (overwrites last click in tab)
  pendingOpIdVerification.set(tabId, {
    targetOpId,
    sourceOrgName,
    expectedOrgName,
  });

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
    );
  }
});

credentialsMessenger.onMessage("getVerificationResult", async ({ data: tabId }) => {
  await stateReady;
  return verificationResults.get(tabId) ?? { status: "none" };
});

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

const getVerificationResult = async (
  tabId: number,
  targetOpId: string,
  sourceOrgName?: string,
  expectedOrgName?: string,
): Promise<LinkVerificationResult> => {
  try {
    const { ops } = await fetchTabCredentials(tabId);
    const decoded = decodeOps(ops);

    if (decoded instanceof Error) {
      return {
        status: "error",
        expectedOpId: targetOpId,
        sourceOrgName,
        expectedOrgName,
        reason:
          import.meta.env.MODE === "development"
            ? `無効なOPS (デコード失敗): ${decoded.message}`
            : "無効なOPS (デコード失敗)",
      };
    }

    const matched = decoded.some((op) =>
      op.media?.some((wmp) => wmp.doc.issuer === targetOpId),
    );

    // Extract destination org name from the first valid OP that looks like a WebMedia
    let destinationOrgName: string | undefined;
    const wmpOp = decoded.find((op) =>
      op.media?.some((wmp) => wmp.doc.issuer === targetOpId),
    );
    if (wmpOp && wmpOp.media && wmpOp.media.length > 0) {
      destinationOrgName = wmpOp.media[0]?.doc?.credentialSubject?.name;
    } else {
      // If mismatch or not found, try to find any WMP name
      const anyWmpOp = decoded.find((op) => op.media && op.media.length > 0);
      destinationOrgName = anyWmpOp?.media?.[0]?.doc?.credentialSubject?.name;
    }

    if (matched) {
      return {
        status: "matched",
        expectedOpId: targetOpId,
        sourceOrgName,
        expectedOrgName,
        destinationOrgName,
      };
    }

    const isMissing = decoded.length === 0;
    const reason = isMissing ? "OPIDが存在しません" : "OPID不一致";
    return {
      status: isMissing ? "missing_opid" : "mismatched",
      expectedOpId: targetOpId,
      sourceOrgName,
      expectedOrgName,
      destinationOrgName,
      reason,
    };
  } catch (e: unknown) {
    const reason = "クレデンシャルが見つかりません (取得失敗)";
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
    return;
  }

  pendingOpIdVerification.delete(tabId);
};

chrome.webNavigation.onCommitted.addListener(async (details) => {
  await stateReady;
  if (details.frameId !== 0) return;
  if (details.transitionQualifiers.includes("forward_back")) {
    pendingOpIdVerification.delete(details.tabId);
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
    await handleVerification(
      details.tabId,
      details.url,
      pending.targetOpId,
      pending.sourceOrgName,
      pending.expectedOrgName,
    );
  } else {
    // If no pending verification (e.g. Back/Forward navigation), try to restore from cache
    const cached = verificationCache.get(details.tabId)?.[details.url];
    if (cached) {
      verificationResults.set(details.tabId, cached);
    }
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
