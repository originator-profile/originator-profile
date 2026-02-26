import { serializeIfError } from "@originator-profile/core";
import { OpVc } from "@originator-profile/model";
import {
  fetchCredentials,
  FetchCredentialSetResult,
  fetchOpMeta,
  fetchSiteProfile,
} from "@originator-profile/presentation";
import {
  normalizeCasItem,
  TargetIntegrityAlgorithm,
  verifyIntegrity,
} from "@originator-profile/verify";

import {
  credentialsMessenger,
  FetchCredentialsMessageResult,
  FetchSiteProfileMessageResult,
  FrameLocation,
  FrameResponse,
  VerifyFailed,
} from "./components/credentials";
import {
  frameCasWindowMessenger,
  isFrameVisible,
  type AncestorFrameCoordinate,
  type CasCoordinate,
  type FrameCasCoordinate,
} from "./components/frameCas";
import { frameCasExtensionMessenger } from "./components/frameCas/extension-events";
import { FetchIntegrityMessageResult } from "./components/integrity/type";
import "./utils/cors-basic-auth";

const toFetchCredentialsMessageResult = <T>(
  result: FetchCredentialSetResult<T>,
): FetchCredentialsMessageResult<T, VerifyFailed> => {
  return serializeIfError(result) as FetchCredentialsMessageResult<
    T,
    VerifyFailed
  >;
};

const toFetchSiteProfileMessageResult = (
  result: Awaited<ReturnType<typeof fetchSiteProfile>>,
): FetchSiteProfileMessageResult => {
  return serializeIfError(result) as FetchSiteProfileMessageResult;
};

credentialsMessenger.onMessage("fetchCredentials", async () => {
  const { ops, cas, opMeta } = await fetchCredentials(document);
  const sp = await fetchSiteProfile(document);
  const frameLocation: FrameLocation = {
    origin: window.origin,
    url: window.location.href,
  };
  return {
    ops: toFetchCredentialsMessageResult(ops),
    cas: toFetchCredentialsMessageResult(cas),
    sp: toFetchSiteProfileMessageResult(sp),
    opMeta,
    ...frameLocation,
  };
});

const AD_CA_TYPES = ["OnlineAd", "Advertorial"] as const;
type AdCaType = (typeof AD_CA_TYPES)[number];

const isAdCaType = (type: string | undefined): type is AdCaType => {
  return type !== undefined && AD_CA_TYPES.includes(type as AdCaType);
};

// CAS JWTをデコードしてペイロードを取得
const decodeCasJwtPayload = (
  casItem: unknown,
):
  | {
      issuer?: string;
      credentialSubject?: { type?: string };
    }
  | undefined => {
  const jwt = normalizeCasItem(casItem).attestation;
  if (typeof jwt !== "string") return undefined;
  try {
    const payload = jwt.split(".")[1];
    if (payload) {
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const binaryString = atob(base64);
      const bytes = Uint8Array.from(binaryString, (c) => c.codePointAt(0) ?? 0);
      return JSON.parse(new TextDecoder().decode(bytes));
    }
  } catch (e) {
    console.error("[ContentScript] Failed to decode CAS JWT", e);
  }
  return undefined;
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

// デコード済みOPペイロードの型（nameを含む）
type DecodedOpPayload = Omit<OpVc, "credentialSubject"> & {
  credentialSubject: OpVc["credentialSubject"] & {
    name?: string;
  };
};

const decodeJwt = (jwt: string | undefined): DecodedOpPayload | undefined => {
  if (!jwt) return undefined;
  try {
    const payload = jwt.split(".")[1];
    if (payload) {
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const binaryString = atob(base64);
      const bytes = Uint8Array.from(binaryString, (c) => c.codePointAt(0) ?? 0);
      return JSON.parse(new TextDecoder().decode(bytes)) as DecodedOpPayload;
    }
  } catch (e) {
    console.error("[ContentScript] Failed to decode JWT", e);
  }
  return undefined;
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

  const getOpMetaProperty = (key: string): string | undefined => {
    const value = (opMeta as Record<string, unknown>)[key];
    return typeof value === "string" ? value : undefined;
  };

  void fetchCredentials(document)
    .then(({ ops, cas }) => {
      const names: { sourceOrgName?: string; expectedOrgName?: string } = {};

      const casIssuer = getCasIssuer(cas);
      const hasCas = Array.isArray(cas) && cas.length > 0;

      if (Array.isArray(ops)) {
        for (const op of ops) {
          const mediaJwt = Array.isArray(op.media) ? op.media[0] : op.media;
          updateOrgNames(
            decodeJwt(mediaJwt),
            casIssuer,
            hasCas,
            opMeta.targetopid,
            names,
          );
          updateOrgNames(
            decodeJwt(op.core),
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
          getOpMetaProperty("targetOrgName") ??
          getOpMetaProperty("targetname"),
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

const sendAdClicked = (opMeta: any, isNewTab: boolean = false) => {
  const getOpMetaProperty = (key: string): string | undefined => {
    const value = (opMeta as Record<string, unknown>)[key];
    return typeof value === "string" ? value : undefined;
  };

  const names = cachedNames ?? {
    expectedOrgName:
      getOpMetaProperty("targetOrgName") ?? getOpMetaProperty("targetname"),
  };

  void credentialsMessenger.sendMessage("adClicked", {
    targetopid: opMeta.targetopid,
    sourceOrgName: names.sourceOrgName,
    expectedOrgName: names.expectedOrgName,
    isNewTab,
  });
};

const handleLinkClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const anchor = target.closest("a");
  if (anchor) {
    const opMeta = fetchOpMeta(document);
    if (opMeta) {
      let isNewTab = anchor.target === "_blank";
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
        isNewTab = true;
      }
      void sendAdClicked(opMeta, isNewTab);
    }
  }
};

document.addEventListener("click", handleLinkClick);
document.addEventListener("mousedown", handleLinkClick);
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (anchor) {
      const opMeta = fetchOpMeta(document);
      if (opMeta) {
        let isNewTab = anchor.target === "_blank";
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          isNewTab = true;
        }
        void sendAdClicked(opMeta, isNewTab);
      }
    }
    return;
  }
  if (e.key === " " || e.key === "Spacebar") {
    const target = e.target as HTMLElement;
    const tagName = target.tagName;
    const role = target.getAttribute("role");
    if (
      tagName === "BUTTON" ||
      tagName === "INPUT" ||
      tagName === "SELECT" ||
      tagName === "TEXTAREA" ||
      role === "button"
    ) {
      const opMeta = fetchOpMeta(document);
      if (opMeta) {
        void sendAdClicked(opMeta, false);
      }
    }
  }
});

credentialsMessenger.onMessage("verifyIntegrity", async ({ data }) => {
  const [content] = data;
  const result = await verifyIntegrity(content);
  return serializeIfError(result) as FetchIntegrityMessageResult;
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
