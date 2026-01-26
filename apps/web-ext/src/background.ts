import { fetchTabCredentials } from "./components/credentials";
import { credentialsMessenger } from "./components/credentials/events";
import { LinkVerificationResult } from "./components/credentials/types";
import { frameCasExtensionMessenger } from "./components/frameCas";
import { updateBadge, verifyTabCredentials } from "./components/tabBadge";
import "./utils/cors-basic-auth";
import { decodeOps } from "@originator-profile/verify";

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

let pendingOpIdVerification: { [tabId: number]: string } = {};
let verificationResults: { [tabId: number]: LinkVerificationResult } = {};

credentialsMessenger.onMessage("adClicked", ({ data, sender }) => {
  if (sender.tab?.id) {
    pendingOpIdVerification[sender.tab.id] = data.targetopid;
  }
});

credentialsMessenger.onMessage("getVerificationResult", ({ data: tabId }) => {
  return verificationResults[tabId] ?? { status: "none" };
});

chrome.webNavigation.onCompleted.addListener(async (details) => {
  console.log("Navigation completed", details);
  if (details.frameId !== 0) return;

  // Navigate したら結果をリセット
  delete verificationResults[details.tabId];

  const targetOpId = pendingOpIdVerification[details.tabId];
  if (targetOpId) {
    console.log("Found pending verification for tab", details.tabId, "Target:", targetOpId);

    delete pendingOpIdVerification[details.tabId];
    try {
      console.log("Fetching credentials...");

      const { ops } = await fetchTabCredentials(details.tabId);

      console.log("Credentials fetched", ops);

      const decoded = decodeOps(ops);
      if (decoded instanceof Error) {
        console.error("Failed to decode OPS", decoded);
        verificationResults[details.tabId] = {
          status: "error",
          expectedOpId: targetOpId,
          reason: "無効なOPS (デコード失敗)",
        };
        return;
      }

      if (decoded.length === 0) {
        console.log("Verification result: No OPID found");
        verificationResults[details.tabId] = {
          status: "missing_opid",
          expectedOpId: targetOpId,
          reason: "OPIDが存在しません",
        };
        return;
      }

      const matched = decoded.some(
        (p) => p.core.doc.credentialSubject.id === targetOpId,
      );
      if (import.meta.env.MODE === "development") {
        console.log("Verification result: matched =", matched);
      }

      if (matched) {
        verificationResults[details.tabId] = {
          status: "matched",
          expectedOpId: targetOpId,
        };
      } else {
        verificationResults[details.tabId] = {
          status: "mismatched",
          expectedOpId: targetOpId,
          reason: "OPID不一致",
        };
      }
    } catch (e: unknown) {
      console.error("Verification failed with error", e);
      verificationResults[details.tabId] = {
        status: "error",
        expectedOpId: targetOpId,
        reason: "クレデンシャルが見つかりません (取得失敗)",
      };
    }
  } else {
    console.log("No pending verification for tab", details.tabId, targetOpId);
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
