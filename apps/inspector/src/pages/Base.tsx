import {
  SiteProfileFetchFailed,
  SiteProfileFetchInvalid,
} from "@originator-profile/presentation";
import { _ } from "@originator-profile/ui";
import {
  CasVerifyFailed,
  OpsInvalid,
  OpsVerifyFailed,
  SiteProfileInvalid,
  SiteProfileVerifyFailed,
  VerifiedCas,
  VerifiedOps,
  VerifiedSp,
} from "@originator-profile/verify";
import flush from "just-flush";
import { Navigate } from "react-router";
import { useMount, useTitle } from "react-use";
import Loading from "../components/Loading";
import Unsupported from "../components/Unsupported";
import {
  FetchCredentialsMessagingFailed,
  FramesVerifiedCas,
  SupportedVerifiedCas,
  useCredentials,
} from "../components/credentials";
import { formatBuildModeTitle } from "../components/environment";
import { useFrameCasLocationProvider } from "../components/frameCas";
import { overlayExtensionMessenger } from "../components/overlay/extension-events";
import { useSiteProfile } from "../components/siteProfile";
import { buildPublUrl, routes } from "../utils/routes";

function Redirect({
  tabId,
  ops,
  framesCas,
}: {
  tabId: number;
  ops?: VerifiedOps;
  framesCas?: FramesVerifiedCas;
}) {
  const cas: SupportedVerifiedCas | undefined = framesCas
    ?.sort((a, b) => a.parentFrameId - b.parentFrameId)
    ?.flatMap((frame) => frame.cas);
  const ca = cas?.[0];
  useMount(() => {
    if (ca) {
      void overlayExtensionMessenger.sendMessage(
        "enter",
        {
          framesCas: framesCas ?? [],
          activeCa: ca ?? null,
          wmps: flush(
            ops?.flatMap((op) => op.media?.map((m) => m.doc) ?? []) ?? [],
          ),
        },
        tabId,
      );
    }
  });

  return <Navigate to={buildPublUrl(tabId, ca?.attestation.doc)} />;
}

function Prohibition({ tabId }: { tabId: number }) {
  const path = [
    routes.base.build({ tabId: String(tabId) }),
    routes.prohibition.build({}),
  ].join("/");
  return <Navigate to={path} />;
}

function isLoading({
  siteProfile,
  spError,
  ops,
  cas,
  credentialsError,
}: {
  siteProfile?: VerifiedSp;
  spError?: Error;
  ops?: VerifiedOps;
  cas?: VerifiedCas;
  credentialsError?: Error;
}) {
  return (!siteProfile && !spError) || (!ops && !cas && !credentialsError);
}

function isSpVerifyError(spError?: Error) {
  if (!spError) {
    return false;
  }

  return (
    "code" in spError &&
    (spError.code === SiteProfileVerifyFailed.code ||
      spError.code === SiteProfileInvalid.code)
  );
}

function isCredentialsVerifyError(credentialsError?: Error) {
  if (!credentialsError) {
    return false;
  }

  return (
    "code" in credentialsError &&
    (credentialsError.code === OpsVerifyFailed.code ||
      credentialsError.code === CasVerifyFailed.code)
  );
}

function Base() {
  const { tabId, siteProfile, error: spError } = useSiteProfile();
  const { ops, cas, framesCas, error: credentialsError } = useCredentials();
  useFrameCasLocationProvider(tabId, framesCas ?? []);

  const title = [_("Base_ContentsInformation"), origin]
    .filter(Boolean)
    .join(" ― ");
  useTitle(formatBuildModeTitle(import.meta.env.MODE, title));

  if (isLoading({ siteProfile, spError, ops, cas, credentialsError })) {
    return <Loading />;
  }

  if (isSpVerifyError(spError) || isCredentialsVerifyError(credentialsError)) {
    return <Prohibition tabId={tabId} />;
  }

  // NOTE: SP と CAS のいずれかが閲覧可能なら表示する
  if (siteProfile || (cas && cas.length > 0)) {
    return <Redirect tabId={tabId} ops={ops} framesCas={framesCas} />;
  }

  const errors = [spError, credentialsError].filter(
    (
      error,
    ): error is
      | SiteProfileFetchFailed
      | SiteProfileFetchInvalid
      | OpsInvalid
      | FetchCredentialsMessagingFailed => {
      if (!error) {
        return false;
      }
      // NOTE: デシリアライズされたが Error インスタンスでないエラーが得られうる
      return error instanceof Error || "code" in error;
    },
  );
  return <Unsupported errors={errors} />;
}

export default Base;
