import { serializeIfError } from "@originator-profile/core";
import { OpMeta, OpVc } from "@originator-profile/model";
import {
  fetchCredentials,
  fetchOpMeta,
} from "@originator-profile/presentation";
import {
  normalizeCasItem,
  TargetIntegrityAlgorithm,
  verifyIntegrity,
} from "@originator-profile/verify";

import { activeTabMessenger } from "./components/activeTab/events";
import {
  credentialsMessenger,
  FrameLocation,
  FrameResponse,
} from "./components/credentials";
import {
  frameCasWindowMessenger,
  isFrameVisible,
  type AncestorFrameCoordinate,
  type CasCoordinate,
  type FrameCasCoordinate,
} from "./components/frameCas";
import { frameCasExtensionMessenger } from "./components/frameCas/extension-events";
import "./utils/cors-basic-auth";

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
      const bytes = Uint8Array.from(binaryString, (c) => c.codePointAt(0) ?? 0);
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
const getCasIssuer = (cas: unknown): string | undefined => {
  if (!Array.isArray(cas)) return undefined;
  for (const casItem of cas) {
    const decoded = decodeCasJwtPayload(casItem);
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

const decodeOpJwt = (jwt: string | undefined): DecodedOpPayload | undefined => {
  if (!jwt) return undefined;
  return decodeJwtPayload<DecodedOpPayload>(jwt);
};

// opMetaオブジェクトからプロパティを文字列として取得
const getOpMetaProperty = (opMeta: OpMeta, key: string): string | undefined => {
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
          const mediaJwt = Array.isArray(op.media) ? op.media[0] : op.media;
          updateOrgNames(
            decodeOpJwt(mediaJwt),
            casIssuer,
            hasCas,
            opMeta.targetopid,
            names,
          );
          updateOrgNames(
            decodeOpJwt(op.core),
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
    // href="javascript:..." は window.open() 等で新規タブを開くパターン
    const isJavascriptHref = anchor.href.startsWith("javascript:");
    const isNewTab =
      anchor.target === "_blank" || isModifierKey || isJavascriptHref;
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

credentialsMessenger.onMessage("verifyIntegrity", async ({ data: content }) => {
  const result = await verifyIntegrity(content);
  return serializeIfError(result);
});

frameCasExtensionMessenger.onMessage(
  "locating",
  async ({ data: { frameCas, frames } }) => {
    const casItems = frameCas.cas.map(normalizeCasItem);
    const cas: CasCoordinate = casItems.map(({ attestation }) => ({
      id: attestation.doc.credentialSubject.id,
      target: attestation.doc.target.flatMap((content) => {
        const elements = TargetIntegrityAlgorithm[content.type].elementSelector(
          { ...content, document },
        );
        return elements.map((el) => el.getBoundingClientRect());
      }),
    }));
    frameCasWindowMessenger.sendMessage(
      "locating",
      {
        frameCas: {
          frameId: frameCas.frameId,
          parentFrameId: frameCas.parentFrameId,
          ancestor: [],
          cas,
        },
        frames,
      },
      window.parent,
      frames.find(({ frameId }) => frameId === frameCas.parentFrameId)?.origin,
    );
  },
);

const updateAncestor = (
  source: WindowProxy | MessagePort | ServiceWorker | null,
  frame: { frameId: number; parentFrameId: number },
  input: AncestorFrameCoordinate[],
): AncestorFrameCoordinate[] => {
  const ancestor = [...input];
  const iframes = document.getElementsByTagName("iframe");
  for (const iframe of iframes) {
    if (source !== iframe.contentWindow) continue;
    const rect = iframe.getBoundingClientRect();
    ancestor.push({
      frameId: frame.frameId,
      parentFrameId: frame.parentFrameId,
      rect,
      visible: isFrameVisible(rect),
    });
    break;
  }
  return ancestor;
};

const sendFrameCasMessage = (
  frame: FrameResponse,
  ancestor: AncestorFrameCoordinate[],
  coordinate: Omit<FrameCasCoordinate, "ancestor">,
  frames: Array<FrameResponse & FrameLocation>,
) => {
  if (frame.frameId === 0) {
    frameCasWindowMessenger.sendMessage(
      "located",
      {
        ancestor,
        ...coordinate,
      },
      window.self,
    );
  } else {
    frameCasWindowMessenger.sendMessage(
      "locating",
      { frameCas: { ancestor, ...coordinate }, frames },
      window.parent,
      frames.find(({ frameId }) => frameId === frame.parentFrameId)?.origin,
    );
  }
};

frameCasWindowMessenger.onMessage(
  "locating",
  ({
    data: {
      frameCas: { ancestor: senderAncestor, ...coordinate },
      frames,
    },
    source,
    origin,
  }) => {
    const frameId =
      senderAncestor.at(-1)?.parentFrameId ?? coordinate.parentFrameId;
    if (frameId === -1) return;
    const frame = frames.find((frame) => frame.frameId === frameId);
    if (!frame) return console.error(`frame not found. frame id: ${frameId}`);
    const senderOrigin = frames.find(
      (f) =>
        f.frameId === (senderAncestor.at(-1)?.frameId ?? coordinate.frameId),
    )?.origin;
    if (origin !== senderOrigin) {
      return console.error(
        `origin mismatch. sender: ${senderOrigin}, receiver: ${origin}`,
      );
    }
    const ancestor = updateAncestor(source, frame, senderAncestor);
    sendFrameCasMessage(frame, ancestor, coordinate, frames);
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
