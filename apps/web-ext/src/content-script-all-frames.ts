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

let isListenerSetup = false;
const setupOpMetaListener = () => {
  if (isListenerSetup) return;
  const opMeta = fetchOpMeta(document);
  if (opMeta) {
    const sendAdClicked = async () => {
      const { ops, cas } = await fetchCredentials(document);
      let sourceOrgName: string | undefined;
      let expectedOrgName: string | undefined;

      // 広告関連のCAタイプ（リンク先確認に使用）
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
            const bytes = Uint8Array.from(
              binaryString,
              (c) => c.codePointAt(0) ?? 0,
            );
            return JSON.parse(new TextDecoder().decode(bytes));
          }
        } catch (e) {
          console.error("[ContentScript] Failed to decode CAS JWT", e);
        }
        return undefined;
      };

      // 広告関連CAS(OnlineAd/Advertorial)のissuerを取得
      let casIssuer: string | undefined;
      if (Array.isArray(cas)) {
        for (const casItem of cas) {
          const decoded = decodeCasJwtPayload(casItem);
          if (decoded && isAdCaType(decoded.credentialSubject?.type)) {
            casIssuer = decoded.issuer;
            break;
          }
        }
      }

      if (Array.isArray(ops)) {
        for (const op of ops) {
          // デコード済みOPペイロードの型（nameを含む）
          type DecodedOpPayload = Omit<OpVc, "credentialSubject"> & {
            credentialSubject: OpVc["credentialSubject"] & {
              name?: string;
            };
          };

          const decodeJwt = (
            jwt: string | undefined,
          ): DecodedOpPayload | undefined => {
            if (!jwt) return undefined;
            try {
              const payload = jwt.split(".")[1];
              if (payload) {
                const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
                const binaryString = atob(base64);
                const bytes = Uint8Array.from(
                  binaryString,
                  (c) => c.codePointAt(0) ?? 0,
                );
                return JSON.parse(
                  new TextDecoder().decode(bytes),
                ) as DecodedOpPayload;
              }
            } catch (e) {
              console.error("[ContentScript] Failed to decode JWT", e);
            }
            return undefined;
          };

          const processPayload = (
            decodedPayload: DecodedOpPayload | undefined,
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

            // sourceOrgName: 広告CAS(OnlineAd/Advertorial)のissuerと一致するOPの名前
            if (!sourceOrgName && casIssuer && isMatch(casIssuer)) {
              sourceOrgName = decodedPayload.credentialSubject.name;
            }

            // expectedOrgName: CAS(全種類)が存在する場合、targetopidと一致するOPの名前
            if (
              Array.isArray(cas) &&
              cas.length > 0 &&
              opMeta.targetopid &&
              isMatch(opMeta.targetopid)
            ) {
              expectedOrgName = decodedPayload.credentialSubject.name;
            }
          };

          const mediaJwt = Array.isArray(op.media) ? op.media[0] : op.media;
          processPayload(decodeJwt(mediaJwt));
          processPayload(decodeJwt(op.core));
        }
      }

      // OpMetaの追加プロパティを取得するヘルパー
      const getOpMetaProperty = (key: string): string | undefined => {
        const value = (opMeta as Record<string, unknown>)[key];
        return typeof value === "string" ? value : undefined;
      };

      void credentialsMessenger.sendMessage("adClicked", {
        targetopid: opMeta.targetopid,
        sourceOrgName,
        expectedOrgName:
          expectedOrgName ??
          getOpMetaProperty("targetOrgName") ??
          getOpMetaProperty("targetname"),
      });
    };
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a")) {
        void sendAdClicked();
      }
    };
    document.addEventListener("click", handleLinkClick);
    document.addEventListener("mousedown", handleLinkClick);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const target = e.target as HTMLElement;
        if (target.closest("a")) {
          void sendAdClicked();
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
          void sendAdClicked();
        }
      }
    });
    isListenerSetup = true;
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupOpMetaListener);
} else {
  setupOpMetaListener();
}

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
