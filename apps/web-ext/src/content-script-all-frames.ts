import { serializeIfError } from "@originator-profile/core";
import {
  fetchCredentials,
  FetchCredentialSetResult,
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
  VerifyFailed,
} from "./components/credentials";
import {
  frameCasWindowMessenger,
  isFrameVisible,
  type CasCoordinate,
} from "./components/frameCas";
import { frameCasExtensionMessenger } from "./components/frameCas/extension-events";
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
  const { ops, cas } = await fetchCredentials(document);
  const frameLocation: FrameLocation = {
    origin: window.origin,
    url: window.location.href,
  };
  return {
    ops: toFetchCredentialsMessageResult(ops),
    cas: toFetchCredentialsMessageResult(cas),
    ...frameLocation,
  };
});

credentialsMessenger.onMessage("verifyIntegrity", async ({ data }) => {
  const [content] = data;
  const result = await verifyIntegrity(content);
  return result;
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

frameCasWindowMessenger.onMessage(
  "locating",
  ({
    data: {
      frameCas: { ancestor, ...coordinate },
      frames,
    },
    source,
    origin,
  }) => {
    const frameId = ancestor.at(-1)?.parentFrameId ?? coordinate.parentFrameId;
    if (frameId === -1) return;
    const frame = frames.find((frame) => frame.frameId === frameId);
    if (!frame) return console.error(`frame not found. frame id: ${frameId}`);
    if (origin !== frame.origin)
      return console.error(`origin mismatch: ${origin}`);
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
  },
);
