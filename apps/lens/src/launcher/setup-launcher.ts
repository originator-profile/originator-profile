import {
  readTabVerification,
  type VerificationEntry,
} from "@originator-profile/extension-common";
import { launcherOf } from "../view/launcher";
import { tabViewOf } from "../view/tab-view";

const DOCUMENT_PREFIX = "verification:document:";
const TAB_PREFIX = "verification:tab:";

/** 検証結果ストアの値の変化が属するタブ。タブに属さなければ undefined */
function tabIdOf(
  key: string,
  { newValue }: chrome.storage.StorageChange,
): number | undefined {
  if (key.startsWith(TAB_PREFIX)) return Number(key.slice(TAB_PREFIX.length));
  if (key.startsWith(DOCUMENT_PREFIX)) {
    return (newValue as VerificationEntry | undefined)?.subject.tabId;
  }
  return undefined;
}

/**
 * ランチャーアイコンのツールチップを、タブの検証の状態に合わせる
 * @param tabId タブID
 */
async function updateLauncher(tabId: number): Promise<void> {
  const verification = await readTabVerification(tabId);
  const view = tabViewOf(tabId, {
    verification,
    reachable: verification.frames.map(({ frame }) => frame.documentId),
  });
  const message =
    view.state === "ready" ? launcherOf(view).tooltip : "extensionName";
  await chrome.action.setTitle({
    tabId,
    title: chrome.i18n.getMessage(message),
  });
}

/** 変化した検証の状態に関わるタブ */
async function affectedTabIds(
  changes: Record<string, chrome.storage.StorageChange>,
): Promise<Set<number>> {
  const entries = Object.entries(changes).filter(([key]) =>
    key.startsWith("verification:"),
  );
  // NOTE: Site Profile とレジストリの結果はタブに属さないため、すべてのタブを見直す
  const shared = entries.some(
    ([key]) => !key.startsWith(DOCUMENT_PREFIX) && !key.startsWith(TAB_PREFIX),
  );
  if (shared) {
    const tabs = await chrome.tabs.query({});
    return new Set(tabs.flatMap(({ id }) => (id === undefined ? [] : [id])));
  }
  return new Set(
    entries.flatMap(([key, change]) => {
      const tabId = tabIdOf(key, change);
      return tabId === undefined || Number.isNaN(tabId) ? [] : [tabId];
    }),
  );
}

/**
 * 検証結果ストアの変化を受けて、ランチャーアイコンのツールチップを更新する
 * (Service Worker で呼ぶ)
 *
 * アイコンの画像は切り替えない。
 */
export function setupLauncher() {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "session") return;
    for (const tabId of await affectedTabIds(changes)) {
      void updateLauncher(tabId).catch((error: unknown) => {
        console.warn(`Failed to update the launcher for tab ${tabId}:`, error);
      });
    }
  });
}
