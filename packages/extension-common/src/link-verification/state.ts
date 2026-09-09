import type { LinkVerificationResult } from "../credentials/types";
import { PersistentMap } from "../utils/persistent-map";
import type { PendingVerificationData, VerificationCacheData } from "./types";

export const pendingOpIdVerification =
  new PersistentMap<PendingVerificationData>("pendingOpIdVerification");

export const verificationResults = new PersistentMap<LinkVerificationResult>(
  "verificationResults",
);

export const verificationCache = new PersistentMap<VerificationCacheData>(
  "verificationCache",
);

let loading: Promise<void> | undefined;

/**
 * 永続化された状態の読み込みを保証する
 *
 * NOTE: モジュール評価時に読み込むと、この状態を使わないコンテンツスクリプトでも
 * chrome.storage を叩くことになるため、最初に必要になった時点で始める
 */
export const ensureStateLoaded = (): Promise<void> => {
  loading ??= Promise.all([
    pendingOpIdVerification.load(),
    verificationResults.load(),
    verificationCache.load(),
  ]).then(() => undefined);
  return loading;
};

// window.openや<a target="_blank">で開かれた新規タブを追跡（openerTabId → newTabId[]）
export const recentlyOpenedTabs = new Map<number, number[]>();

// handleVerification の二重実行を防止するガード
export const verificationInProgress = new Set<number>();
