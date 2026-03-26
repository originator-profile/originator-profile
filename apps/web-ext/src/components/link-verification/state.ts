import { PersistentMap } from "../../utils/persistent-map";
import type { LinkVerificationResult } from "../credentials/types";
import type { PendingVerificationData, VerificationCacheData } from "./types";

export const pendingOpIdVerification =
  new PersistentMap<PendingVerificationData>("pendingOpIdVerification");

export const verificationResults = new PersistentMap<LinkVerificationResult>(
  "verificationResults",
);

export const verificationCache = new PersistentMap<VerificationCacheData>(
  "verificationCache",
);

export const stateReady = Promise.all([
  pendingOpIdVerification.load(),
  verificationResults.load(),
  verificationCache.load(),
]);

// window.openや<a target="_blank">で開かれた新規タブを追跡（openerTabId → newTabId[]）
export const recentlyOpenedTabs = new Map<number, number[]>();

// handleVerification の二重実行を防止するガード
export const verificationInProgress = new Set<number>();
