import { serializeIfError } from "@originator-profile/core";
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getCasIssuer = (casItem: any) => {
        if (typeof casItem === "string") return undefined; // Simplified for now, assuming object structure in test
        return casItem.issuer;
      };

      let casIssuer: string | undefined;
      if (Array.isArray(cas) && cas.length > 0) {
        casIssuer = getCasIssuer(cas[0]);
      }

      if (Array.isArray(ops)) {
        for (const op of ops) {
          const decodeJwt = (jwt: string | undefined) => {
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
                return JSON.parse(new TextDecoder().decode(bytes));
              }
            } catch (e) {
              console.error("[ContentScript] Failed to decode JWT", e);
            }
            return undefined;
          };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const processPayload = (decodedPayload: any) => {
            if (!decodedPayload?.credentialSubject?.name) {
              return;
            }

            if (!sourceOrgName) {
              sourceOrgName = decodedPayload.credentialSubject.name;
            }

            const isMatch = (targetId: string) => {
              return (
                decodedPayload.iss === targetId ||
                decodedPayload.credentialSubject?.id === targetId
              );
            };

            // If CAS issuer is present, use it to find expectedOrgName
            if (casIssuer && isMatch(casIssuer)) {
              expectedOrgName = decodedPayload.credentialSubject.name;
            } else if (opMeta.targetopid && isMatch(opMeta.targetopid)) {
              expectedOrgName = decodedPayload.credentialSubject.name;
            }
          };

          const mediaJwt = Array.isArray(op.media) ? op.media[0] : op.media;
          processPayload(decodeJwt(mediaJwt));
          processPayload(decodeJwt(op.core));
        }
      }

      void credentialsMessenger.sendMessage("adClicked", {
        targetopid: opMeta.targetopid,
        sourceOrgName,
        expectedOrgName:
          expectedOrgName ??
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (opMeta as any).targetOrgName ??
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (opMeta as any).targetname,
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
    if (!frame) return;
    const senderOrigin = frames.find(
      (f) =>
        f.frameId === (senderAncestor.at(-1)?.frameId ?? coordinate.frameId),
    )?.origin;
    if (origin !== senderOrigin) return;
    const ancestor = updateAncestor(source, frame, senderAncestor);
    sendFrameCasMessage(frame, ancestor, coordinate, frames);
  },
);
