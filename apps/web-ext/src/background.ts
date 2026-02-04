import { WebMediaProfile } from "@originator-profile/model";
import { decodeOps } from "@originator-profile/verify";
import { fetchTabCredentials } from "./components/credentials";
import { credentialsMessenger } from "./components/credentials/events";
import { LinkVerificationResult } from "./components/credentials/types";
import { frameCasExtensionMessenger } from "./components/frameCas";
import { updateBadge, verifyTabCredentials } from "./components/tabBadge";
import "./utils/cors-basic-auth";

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

const pendingOpIdVerification: {
  [tabId: number]: { targetOpId: string; sourceOrgName?: string };
} = {};
const verificationResults: { [tabId: number]: LinkVerificationResult } = {};

// Clean up state when a tab is closed to prevent memory leaks
const pendingClicks: {
  [tabId: number]: {
    [frameId: number]: { targetOpId: string; sourceOrgName?: string };
  };
} = {};
const pendingNewTabAssociations: {
  [tabId: number]: { [frameId: number]: number[] };
} = {};

// Clean up state when a tab is closed to prevent memory leaks
chrome.tabs.onRemoved.addListener((tabId) => {
  if (pendingOpIdVerification[tabId]) {
    delete pendingOpIdVerification[tabId];
  }
  if (verificationResults[tabId]) {
    delete verificationResults[tabId];
  }
  if (pendingClicks[tabId]) {
    delete pendingClicks[tabId];
  }
  if (pendingNewTabAssociations[tabId]) {
    delete pendingNewTabAssociations[tabId];
  }
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
chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
  const { sourceTabId, sourceFrameId, tabId } = details;
  // If we already have a pending click from this source frame, associate it immediately
  if (pendingClicks[sourceTabId]?.[sourceFrameId]) {
    pendingOpIdVerification[tabId] = pendingClicks[sourceTabId][sourceFrameId];
  } else {
    // Otherwise, store usage association for when the click message arrives
    if (!pendingNewTabAssociations[sourceTabId]) {
      pendingNewTabAssociations[sourceTabId] = {};
    }
    if (!pendingNewTabAssociations[sourceTabId][sourceFrameId]) {
      pendingNewTabAssociations[sourceTabId][sourceFrameId] = [];
    }
    pendingNewTabAssociations[sourceTabId][sourceFrameId].push(tabId);
  }
});

// Propagate verification state to new tabs opened via window.open (Legacy/Fallback)
chrome.tabs.onCreated.addListener((tab) => {
  const openerId = tab.openerTabId;
  if (openerId !== undefined) {
    const pending = pendingOpIdVerification[openerId];
    // Only inherit if we haven't already set it via onCreatedNavigationTarget (which is more precise)
    if (pending && tab.id !== undefined && !pendingOpIdVerification[tab.id]) {
      pendingOpIdVerification[tab.id] = pending;
    }
  }
});

const handleAdClicked = (
  tabId: number,
  frameId: number,
  targetOpId: string,
  sourceOrgName?: string,
) => {
  // Store the click for this frame
  if (!pendingClicks[tabId]) {
    pendingClicks[tabId] = {};
  }
  pendingClicks[tabId][frameId] = { targetOpId, sourceOrgName };

  // Also update main pending map for same-tab navigations (overwrites last click in tab)
  pendingOpIdVerification[tabId] = { targetOpId, sourceOrgName };

  // Check if any new tabs were already created by this frame waiting for this opId
  const tabAssociations = pendingNewTabAssociations[tabId];
  const waitingTabs = tabAssociations?.[frameId];

  if (tabAssociations && waitingTabs) {
    for (const newTabId of waitingTabs) {
      pendingOpIdVerification[newTabId] = { targetOpId, sourceOrgName };
    }
    // Clear associations as they are fulfilled
    delete tabAssociations[frameId];
  }
};

credentialsMessenger.onMessage("adClicked", async ({ data, sender }) => {
  if (sender.tab?.id && sender.frameId !== undefined) {
    handleAdClicked(
      sender.tab.id,
      sender.frameId,
      data.targetopid,
      data.sourceOrgName,
    );
  }
});

credentialsMessenger.onMessage("getVerificationResult", ({ data: tabId }) => {
  return verificationResults[tabId] ?? { status: "none" };
});

const executeWarningRedirect = (
  tabId: number,
  url: string,
  reason: string,
  sourceOrg?: string,
  destOrg?: string,
) => {
  const params = new URLSearchParams({
    target: url,
    reason,
  });
  if (sourceOrg) params.append("sourceOrg", sourceOrg);
  if (destOrg) params.append("destOrg", destOrg);

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
): Promise<LinkVerificationResult> => {
  try {
    const { ops } = await fetchTabCredentials(tabId);
    const decoded = decodeOps(ops);

    if (decoded instanceof Error) {
      return {
        status: "error",
        expectedOpId: targetOpId,
        sourceOrgName,
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
        destinationOrgName,
      };
    }

    const isMissing = decoded.length === 0;
    const reason = isMissing ? "OPIDが存在しません" : "OPID不一致";
    return {
      status: isMissing ? "missing_opid" : "mismatched",
      expectedOpId: targetOpId,
      sourceOrgName,
      destinationOrgName,
      reason,
    };
  } catch (e: unknown) {
    const reason = "クレデンシャルが見つかりません (取得失敗)";
    return {
      status: "error",
      expectedOpId: targetOpId,
      sourceOrgName,
      reason,
    };
  }
};

const handleVerification = async (
  tabId: number,
  url: string,
  targetOpId: string,
  sourceOrgName?: string,
) => {
  // Check if user allowed this destination.
  const isAllowed = await consumeAllowedNavigation(tabId, url);
  const result = await getVerificationResult(tabId, targetOpId, sourceOrgName);
  verificationResults[tabId] = result;

  if (result.status !== "matched" && !isAllowed) {
    const reason = result.reason ?? "Unknown Error";
    executeWarningRedirect(
      tabId,
      url,
      reason,
      result.sourceOrgName,
      result.destinationOrgName,
    );
  }

  delete pendingOpIdVerification[tabId];
};

chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;

  // Navigate したら結果をリセット
  delete verificationResults[details.tabId];

  const pending = pendingOpIdVerification[details.tabId];
  if (pending) {
    await handleVerification(
      details.tabId,
      details.url,
      pending.targetOpId,
      pending.sourceOrgName,
    );
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
