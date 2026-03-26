import { buildWarningSearchParams } from "../../utils/warning-params";
import {
  pendingOpIdVerification,
  recentlyOpenedTabs,
  verificationCache,
  verificationInProgress,
  verificationResults,
} from "./state";
import type {
  ExecuteWarningRedirectParams,
  HandleAdClickedParams,
  HandleVerificationParams,
  VerificationContext,
} from "./types";
import { getVerificationResult } from "./verification";

/**
 * 検証失敗時に警告ページへリダイレクトする
 * @param params - リダイレクト情報
 */
export const executeWarningRedirect = ({
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
 * ページ読み込み完了時にOPID検証を実行し、不一致の場合は警告ページへリダイレクトする
 * @param params - 検証に必要な情報
 */
export const handleVerification = async ({
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
    verificationCache.update(tabId, (current) => ({
      ...(current ?? {}),
      [url]: result,
    }));

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

/**
 * 広告クリックを処理し、検証情報をタブに紐付ける
 * @param params - 広告クリック情報
 */
export const handleAdClicked = ({
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

export const restoreVerificationFromCache = (tabId: number, url: string) => {
  const cached = verificationCache.get(tabId)?.[url];
  if (cached) {
    verificationResults.set(tabId, cached);
  }
};
