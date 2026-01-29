import { serializeIfError } from "@originator-profile/core";
import {
  fetchCredentials,
  FetchCredentialSetResult,
  fetchOpMeta,
} from "@originator-profile/presentation";
import {
  normalizeCasItem,
  TargetIntegrityAlgorithm,
  verifyIntegrity,
} from "@originator-profile/verify";
import {
  credentialsMessenger,
  FetchCredentialsMessageResult,
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

credentialsMessenger.onMessage("fetchCredentials", async () => {
  const { ops, cas, opMeta } = await fetchCredentials(document);

  const frameLocation: FrameLocation = {
    origin: window.origin,
    url: window.location.href,
  };
  return {
    ops: toFetchCredentialsMessageResult(ops),
    cas: toFetchCredentialsMessageResult(cas),
    opMeta,
    ...frameLocation,
  };
});

let isListenerSetup = false;
const setupOpMetaListener = () => {
  if (isListenerSetup) return;
  const opMeta = fetchOpMeta(document);
  if (opMeta) {
    document.addEventListener("click", () => {
      void credentialsMessenger.sendMessage("adClicked", {
        targetopid: opMeta.targetopid,
      });
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
