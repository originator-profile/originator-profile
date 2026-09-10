import { serializeIfError } from "@originator-profile/core";
import { OpMeta, OpVc } from "@originator-profile/model";
import {
  fetchCredentials,
  fetchOpMeta,
  fetchSiteProfile,
  type CredentialsFetchFailed,
  type SourcedCredential,
} from "@originator-profile/presentation";
import { normalizeCasItem, verifyIntegrity } from "@originator-profile/verify";
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

  const AD_CA_TYPES = ["OnlineAd", "Advertorial"] as const;
  type AdCaType = (typeof AD_CA_TYPES)[number];

  const isAdCaType = (type: string | undefined): type is AdCaType => {
    return type !== undefined && AD_CA_TYPES.includes(type as AdCaType);
  };

  // JWTペイロードのBase64デコード
  const decodeJwtPayload = <T = unknown>(jwt: string): T | undefined => {
    try {
      const payload = jwt.split(".")[1];
      if (payload) {
        const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64.padEnd(
          base64.length + ((4 - (base64.length % 4)) % 4),
          "=",
        );
        const binaryString = atob(padded);
        const bytes = Uint8Array.from(
          binaryString,
          (c) => c.codePointAt(0) ?? 0,
        );
        return JSON.parse(new TextDecoder().decode(bytes)) as T;
      }
    } catch (e) {
      console.error("[ContentScript] Failed to decode JWT payload", e);
    }
    return undefined;
  };

  const decodeCasJwtPayload = (
    casItem: unknown,
  ): { issuer?: string; credentialSubject?: { type?: string } } | undefined => {
    const jwt = normalizeCasItem(casItem).attestation;
    return typeof jwt === "string" ? decodeJwtPayload(jwt) : undefined;
  };

  // 広告関連CAS(OnlineAd/Advertorial)のissuerを取得
  const getCasIssuer = (
    cas: SourcedCredential<unknown>[] | CredentialsFetchFailed,
  ): string | undefined => {
    if (!Array.isArray(cas)) return undefined;
    for (const casItem of cas) {
      const decoded = decodeCasJwtPayload(casItem.credential);
      if (decoded && isAdCaType(decoded.credentialSubject?.type)) {
        return decoded.issuer;
      }
    }
    return undefined;
  };

  type DecodedOpPayload = Omit<OpVc, "credentialSubject"> & {
    credentialSubject: OpVc["credentialSubject"] & {
      name?: string;
    };
  };

  const decodeOpJwt = (
    jwt: string | undefined,
  ): DecodedOpPayload | undefined => {
    if (!jwt) return undefined;
    return decodeJwtPayload<DecodedOpPayload>(jwt);
  };

  // opMetaオブジェクトからプロパティを文字列として取得
  const getOpMetaProperty = (
    opMeta: OpMeta,
    key: string,
  ): string | undefined => {
    const value = opMeta[key];
    return typeof value === "string" ? value : undefined;
  };

  const updateOrgNames = (
    decodedPayload: DecodedOpPayload | undefined,
    casIssuer: string | undefined,
    hasCas: boolean,
    targetopid: string | undefined,
    currentNames: { sourceOrgName?: string; expectedOrgName?: string },
  ) => {
    if (!decodedPayload?.credentialSubject?.name) {
      return;
    }

    const isMatch = (targetId: string) => {
      return (
        decodedPayload.issuer === targetId ||
        decodedPayload.credentialSubject?.id === targetId
      );
    };

    if (!currentNames.sourceOrgName && casIssuer && isMatch(casIssuer)) {
      currentNames.sourceOrgName = decodedPayload.credentialSubject.name;
    }

    if (hasCas && targetopid && isMatch(targetopid)) {
      currentNames.expectedOrgName = decodedPayload.credentialSubject.name;
    }
  };

  let cachedNames:
    | { sourceOrgName?: string; expectedOrgName?: string }
    | undefined;

  const tryCacheNames = () => {
    const opMeta = fetchOpMeta(document);
    if (!opMeta) return;

    void fetchCredentials(document)
      .then(({ ops, cas }) => {
        const names: { sourceOrgName?: string; expectedOrgName?: string } = {};

        const casIssuer = getCasIssuer(cas);
        const hasCas = Array.isArray(cas) && cas.length > 0;

        if (Array.isArray(ops)) {
          for (const op of ops) {
            const mediaJwt = Array.isArray(op.credential.media)
              ? op.credential.media[0]
              : op.credential.media;
            updateOrgNames(
              decodeOpJwt(mediaJwt),
              casIssuer,
              hasCas,
              opMeta.targetopid,
              names,
            );
            updateOrgNames(
              decodeOpJwt(op.credential.core),
              casIssuer,
              hasCas,
              opMeta.targetopid,
              names,
            );
          }
        }

        cachedNames = {
          sourceOrgName: names.sourceOrgName,
          expectedOrgName:
            names.expectedOrgName ??
            getOpMetaProperty(opMeta, "targetOrgName") ??
            getOpMetaProperty(opMeta, "targetname"),
        };
      })
      .catch((e) => {
        console.error("[ContentScript] Pre-fetch credentials failed", e);
      });
  };

  if (document.readyState === "loading") {
    tryCacheNames();
    document.addEventListener("DOMContentLoaded", tryCacheNames);
  } else {
    tryCacheNames();
  }

  const sendAdClicked = (opMeta: OpMeta, isNewTab: boolean = false) => {
    const names = cachedNames ?? {
      expectedOrgName:
        getOpMetaProperty(opMeta, "targetOrgName") ??
        getOpMetaProperty(opMeta, "targetname"),
    };

    void credentialsMessenger.sendMessage("adClicked", {
      targetopid: getOpMetaProperty(opMeta, "targetopid") as string,
      sourceOrgName: names.sourceOrgName,
      expectedOrgName: names.expectedOrgName,
      isNewTab,
    });
  };

  const handleLinkClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    const opMeta = anchor ? fetchOpMeta(document) : undefined;
    if (anchor && opMeta) {
      const isModifierKey =
        e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1;
      const isNewTab =
        anchor.target === "_blank" ||
        isModifierKey ||
        NON_NAVIGATING_SCHEMES.includes(anchor.protocol);
      void sendAdClicked(opMeta, isNewTab);
    }
  };

  document.addEventListener("click", handleLinkClick);
  document.addEventListener("mousedown", (e: MouseEvent) => {
    // ミドルクリック（button === 1）のみを処理
    // 左クリックは click イベントで処理済みのため、二重送信を防止
    if (e.button === 1) {
      handleLinkClick(e);
    }
  });

  const handleEnterKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    const opMeta = anchor ? fetchOpMeta(document) : undefined;
    if (anchor && opMeta) {
      const isModifierKey = e.ctrlKey || e.metaKey || e.shiftKey;
      const isNewTab = anchor.target === "_blank" || isModifierKey;
      void sendAdClicked(opMeta, isNewTab);
    }
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
        void sendAdClicked(opMeta, false);
      }
    }
  };

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleEnterKey(e);
      return;
    }
    if (e.key === " " || e.key === "Spacebar") {
      handleSpaceKey(e);
    }
  });

  credentialsMessenger.onMessage(
    "verifyIntegrity",
    async ({ data: content }) => {
      const result = await verifyIntegrity(content);
      return serializeIfError(result);
    },
  );
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
