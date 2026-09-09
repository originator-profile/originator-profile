import { selectByLocale, serializeIfError } from "@originator-profile/core";
import {
  ContentAttestation,
  ContentAttestationSet,
  ContentAttestationSetItem,
  OpMeta,
  OriginatorProfileSet,
  WebMediaProfile,
} from "@originator-profile/model";
import {
  CredentialsFetchFailed,
  fetchCredentials,
  fetchOpMeta,
  fetchSiteProfile,
} from "@originator-profile/presentation";
import { JwtVcDecoder } from "@originator-profile/securing-mechanism";
import {
  decodeOps,
  normalizeCasItem,
  verifyIntegrity,
} from "@originator-profile/verify";
import { activeTabMessenger } from "./active-tab/events";
import { credentialsMessenger } from "./credentials/events";
import type { FrameLocation } from "./credentials/types";
import { siteProfileMessenger } from "./site-profile/events";
import "./utils/cors-basic-auth";

/**
 * 同一タブでの通常のナビゲーションを起こさないスキーム
 *
 * NOTE: 遷移しないなら新規タブが開かれたとみなす推定であり、href="#" や
 * preventDefault() で window.open() を呼ぶ実装は拾えない (#517)
 */
const NON_NAVIGATING_SCHEMES: readonly string[] = [
  "javascript:",
  "data:",
  "vbscript:",
];

/**
 * リンクの活性化が新規タブを開くとみなせるか
 * @param anchor 活性化されたリンク
 * @param e 活性化のきっかけとなったイベント
 */
const opensInNewTab = (
  anchor: HTMLAnchorElement,
  e: MouseEvent | KeyboardEvent,
): boolean =>
  anchor.target === "_blank" ||
  e.ctrlKey ||
  e.metaKey ||
  e.shiftKey ||
  ("button" in e && e.button === 1) ||
  NON_NAVIGATING_SCHEMES.includes(anchor.protocol);

const AD_CA_TYPES = ["OnlineAd", "Advertorial"] as const;
type AdCaType = (typeof AD_CA_TYPES)[number];

const isAdCaType = (type: string | undefined): type is AdCaType => {
  return type !== undefined && AD_CA_TYPES.includes(type as AdCaType);
};

const decodeCa = JwtVcDecoder<ContentAttestation>();

const decodeCasItem = (casItem: ContentAttestationSetItem) => {
  const jwt = normalizeCasItem(casItem).attestation;
  if (typeof jwt !== "string") return undefined;
  const decoded = decodeCa(jwt);
  if (decoded instanceof Error) {
    console.error("[ContentScript] Failed to decode CA", decoded);
    return undefined;
  }
  return decoded.doc;
};

// 広告関連CA(OnlineAd/Advertorial)のissuerを取得
const getAdCaIssuer = (cas: ContentAttestationSet): string | undefined => {
  for (const casItem of cas) {
    const doc = decodeCasItem(casItem);
    if (doc && isAdCaType(doc.credentialSubject.type)) {
      return doc.issuer;
    }
  }
  return undefined;
};

/** 広告リンクのクリックとともに送る組織名 */
type OrgNames = { sourceOrgName?: string; expectedOrgName?: string };

/**
 * OP ごとに、閲覧者のロケールに合う Web Media Profile を選ぶ
 * @param ops Originator Profile Set
 */
const selectWebMediaProfiles = (
  ops: OriginatorProfileSet,
): WebMediaProfile[] => {
  const decoded = decodeOps(ops);
  if (decoded instanceof Error) {
    console.error(
      "[ContentScript] Failed to decode Originator Profile Set",
      decoded,
    );
    return [];
  }
  return decoded.flatMap((op) => {
    const wmp = op.media && selectByLocale(op.media.map(({ doc }) => doc));
    return wmp ? [wmp] : [];
  });
};

/**
 * 広告リンクのクリックとともに送る組織名を解決する
 *
 * NOTE: 突き合わせる相手は WMP の credentialSubject.id である。issuer は OP の
 * 発行者を指すため、広告 CA の issuer とも targetopid とも一致しない
 * @param wmps OP ごとに選ばれた Web Media Profile
 * @param adCaIssuer 広告 CA の issuer
 * @param targetopid 広告が宣言する遷移先の OP ID
 */
const resolveOrgNames = (
  wmps: WebMediaProfile[],
  adCaIssuer: string | undefined,
  targetopid: string,
): OrgNames => {
  const nameOf = (opId: string) =>
    wmps.find((wmp) => wmp.credentialSubject.id === opId)?.credentialSubject
      .name;

  return {
    sourceOrgName: adCaIssuer ? nameOf(adCaIssuer) : undefined,
    expectedOrgName: nameOf(targetopid),
  };
};

/**
 * 全フレームで登録するハンドラ
 *
 * クレデンシャルの取得、Target Integrity の検証、広告リンクのクリック検知、
 * 準備完了の通知をおこなう。
 */
export function setupFrameHandlers() {
  credentialsMessenger.onMessage("fetchCredentials", async () => {
    const { ops, cas } = await fetchCredentials(document);
    const opMeta = fetchOpMeta(document);
    const frameLocation: FrameLocation = {
      origin: window.origin,
      url: window.location.href,
    };
    return {
      ops: serializeIfError(ops),
      cas: serializeIfError(cas),
      opMeta,
      ...frameLocation,
    };
  });

  credentialsMessenger.onMessage(
    "verifyIntegrity",
    async ({ data: content }) => {
      const result = await verifyIntegrity(content);
      return serializeIfError(result);
    },
  );

  let cachedNames: OrgNames | undefined;

  const tryCacheNames = () => {
    const opMeta = fetchOpMeta(document);
    if (!opMeta) return;

    void fetchCredentials(document)
      .then(({ ops, cas }) => {
        if (ops instanceof CredentialsFetchFailed) return;
        cachedNames = resolveOrgNames(
          selectWebMediaProfiles(ops),
          cas instanceof CredentialsFetchFailed
            ? undefined
            : getAdCaIssuer(cas),
          opMeta.targetopid,
        );
      })
      .catch((e) => {
        console.error("[ContentScript] Pre-fetch credentials failed", e);
      });
  };

  tryCacheNames();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryCacheNames, {
      once: true,
    });
  }

  const sendAdClicked = (opMeta: OpMeta, isNewTab: boolean) => {
    const names = cachedNames;

    void credentialsMessenger.sendMessage("adClicked", {
      targetopid: opMeta.targetopid,
      sourceOrgName: names?.sourceOrgName,
      expectedOrgName: names?.expectedOrgName,
      isNewTab,
    });
  };

  const handleAnchorActivation = (e: MouseEvent | KeyboardEvent) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor) return;
    const opMeta = fetchOpMeta(document);
    if (!opMeta) return;
    sendAdClicked(opMeta, opensInNewTab(anchor, e));
  };

  const handleSpaceKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const tagName = target.tagName;
    const role = target.getAttribute("role");
    const isButtonOrInput =
      tagName === "BUTTON" ||
      tagName === "INPUT" ||
      tagName === "SELECT" ||
      tagName === "TEXTAREA" ||
      role === "button";

    if (isButtonOrInput) {
      const opMeta = fetchOpMeta(document);
      if (opMeta) {
        sendAdClicked(opMeta, false);
      }
    }
  };

  document.addEventListener("click", handleAnchorActivation);
  document.addEventListener("mousedown", (e: MouseEvent) => {
    // ミドルクリックは click を発火せず auxclick を発火するため、ここで拾う
    if (e.button === 1) {
      handleAnchorActivation(e);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleAnchorActivation(e);
      return;
    }
    if (e.key === " " || e.key === "Spacebar") {
      handleSpaceKey(e);
    }
  });

  // Side Panel にコンテンツスクリプトの準備完了を通知する
  const notifyReady = () => {
    void activeTabMessenger.sendMessage("contentReady", null);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", notifyReady, { once: true });
  } else {
    notifyReady();
  }

  // bfcache から復元された場合、Content Script は再注入されないため
  // pageshow イベントで contentReady を再送信する
  // see: https://developer.chrome.com/blog/bfcache-extension-messaging-changes
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      notifyReady();
    }
  });
}

/**
 * 最上位フレームで登録するハンドラ
 *
 * Site Profile の取得をおこなう。
 */
export function setupTopFrameHandlers() {
  siteProfileMessenger.onMessage("fetchSiteProfile", async () => {
    const data = await fetchSiteProfile(document);
    return serializeIfError(data);
  });
}
