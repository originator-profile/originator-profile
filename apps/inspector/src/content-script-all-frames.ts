import {
  type AncestorFrameCoordinate,
  type CasCoordinate,
  type FrameCasCoordinate,
  frameCasExtensionMessenger,
  frameCasWindowMessenger,
  FrameLocation,
  FrameResponse,
} from "@originator-profile/extension-common";
import { setupFrameHandlers } from "@originator-profile/extension-common/content-script";
import {
  normalizeCasItem,
  TargetIntegrityAlgorithm,
} from "@originator-profile/verify";
import { isFrameVisible } from "./components/frameCas";

setupFrameHandlers();

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
