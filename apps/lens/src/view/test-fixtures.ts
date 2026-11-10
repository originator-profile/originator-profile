import type {
  SubscribedTabVerification,
  VerificationEntry,
} from "@originator-profile/extension-common";
import type { OriginatorPayload } from "@originator-profile/verify";

export const origin = "https://media.example";

export const core = (id: string) => ({
  type: ["VerifiableCredential", "CoreProfile"],
  issuer: "dns:registry.example",
  credentialSubject: { id, type: "Core" },
});

export const wmp = (id: string, name: string) => ({
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  type: ["VerifiableCredential", "WebMediaProfile"],
  issuer: "dns:registry.example",
  credentialSubject: {
    id,
    type: "OnlineBusiness",
    url: `https://${name}.example/`,
    name,
    logo: { id: `https://${name}.example/logo.png` },
  },
});

export const existencePa = (id: string, addressCountry: string) => ({
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  type: ["VerifiableCredential", "Certificate"],
  issuer: "dns:pa-issuer.example",
  credentialSubject: {
    id,
    type: "JP-OrganizationExistenceCertificate",
    annotation: {
      id: "urn:uuid:existence",
      type: "ProfileAnnotationPolicy",
      name: "組織実在証",
      ref: "https://pa-issuer.example/policy",
    },
    addressCountry,
  },
});

export const membershipPa = (id: string, policy: string) => ({
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  type: ["VerifiableCredential", "Certificate"],
  issuer: "dns:association.example",
  credentialSubject: {
    id,
    type: "Membership",
    annotation: { id: policy, type: "ProfileAnnotationPolicy", name: policy },
  },
});

export const originator = (
  id: string,
  { name, annotations = [] }: { name?: string; annotations?: unknown[] } = {},
) =>
  ({
    core: core(id),
    media: name ? [wmp(id, name)] : undefined,
    annotations,
  }) as unknown as OriginatorPayload;

export const ca = (
  issuer: string,
  id: string,
  { type = "Article", title = id }: { type?: string; title?: string } = {},
) => ({
  type: ["VerifiableCredential", "ContentAttestation"],
  issuer,
  target: [{ type: "TextTargetIntegrity", cssSelector: `[data-ca="${id}"]` }],
  credentialSubject: {
    id,
    type,
    ...(type === "OnlineAd" ? { name: title } : { headline: title }),
    image: { id: `${id}/thumbnail.png` },
  },
});

type Frame = {
  frameId: number;
  parentFrameId: number;
  documentId: string;
  frameType: chrome.extensionTypes.FrameType;
  origin: string;
  url: string;
};

export const topFrame: Frame = {
  frameId: 0,
  parentFrameId: -1,
  documentId: "top",
  frameType: "outermost_frame",
  origin,
  url: `${origin}/`,
};

export const subFrame: Frame = {
  frameId: 1,
  parentFrameId: 0,
  documentId: "sub",
  frameType: "sub_frame",
  origin: "https://ad.example",
  url: "https://ad.example/",
};

const metadata = {
  securingResults: [],
  warnings: [],
  info: [],
  verifiedAt: "2026-11-10T00:00:00.000Z",
  scope: [],
};

export const problem = (code: string) => ({
  type: `https://docs.originator-profile.org/error-reference/${code}/`,
  title: code,
});

export const success = <T>(outcome: T) => ({
  status: true as const,
  outcome,
  ...metadata,
});

export const failure = (code: string) => ({
  status: false as const,
  errors: [problem(code)],
  ...metadata,
});

export const settled = (
  frame: Frame,
  result: unknown,
  { usesSiteProfile = true }: { usesSiteProfile?: boolean } = {},
) =>
  ({
    state: "settled",
    subject: { ...frame, tabId: 1 },
    credentials: { ops: [], cas: [] },
    result: {
      inputRange: [
        { kind: "registry" },
        ...(usesSiteProfile ? [{ kind: "site-profile" }] : []),
      ],
      ...(result as object),
    },
    inputIdentity: { cas: [], ops: [], targets: [], evaluatedUrl: origin },
  }) as unknown as VerificationEntry;

export const document = (
  originators: OriginatorPayload[],
  cas: { main: boolean; attestation: unknown }[],
) => success({ originators, cas });

/** タブの検証の状態を組み立てる */
export function subscribed({
  frames,
  siteProfile,
  registry = success({ originators: [] }),
}: {
  frames: { frame: Frame; entry?: VerificationEntry }[];
  siteProfile?: unknown;
  registry?: unknown;
}): SubscribedTabVerification {
  return {
    reachable: frames.map(({ frame }) => frame.documentId),
    verification: {
      frames: frames.map(({ frame, entry }) => ({
        frame: frame as never,
        entry,
      })),
      siteProfile:
        siteProfile === undefined
          ? undefined
          : ({ state: "settled", origin, result: siteProfile } as never),
      registry: registry as never,
    },
  };
}
