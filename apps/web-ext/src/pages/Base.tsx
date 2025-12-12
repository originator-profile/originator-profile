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
import { useCallback } from "react";
import { Navigate } from "react-router";
import { useMount, useTitle } from "react-use";
import Loading from "../components/Loading";
import Unsupported from "../components/Unsupported";
import {
  FetchCredentialsMessagingFailed,
  FramesVerifiedCas,
  useCredentials,
} from "../components/credentials";
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
  const pageCas =
    framesCas?.find((frameCas) => frameCas.parentFrameId === -1)?.cas ?? [];
  const [ca] = pageCas ?? [];
  useMount(() => {
    if (pageCas) {
      void overlayExtensionMessenger.sendMessage(
        "enter",
        {
          framesCas: framesCas ?? [],
          activeCa: ca ?? null,
          wmps: flush(ops?.map((op) => op.media?.doc) ?? []),
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
  sp_error,
  ops,
  cas,
  credentials_error,
}: {
  siteProfile?: VerifiedSp;
  sp_error?: Error;
  ops?: VerifiedOps;
  cas?: VerifiedCas;
  credentials_error?: Error;
}) {
  return (!siteProfile && !sp_error) || (!ops && !cas && !credentials_error);
}

function isSpVerifyError(sp_error?: Error) {
  if (!sp_error) {
    return false;
  }

  return (
    "code" in sp_error &&
    (sp_error.code === SiteProfileVerifyFailed.code ||
      sp_error.code === SiteProfileInvalid.code)
  );
}

function isCredentialsVerifyError(credentials_error?: Error) {
  if (!credentials_error) {
    return false;
  }

  return (
    "code" in credentials_error &&
    (credentials_error.code === OpsVerifyFailed.code ||
      credentials_error.code === CasVerifyFailed.code)
  );
}

function Base() {
  const { tabId, siteProfile, error: sp_error } = useSiteProfile();
  const { ops, cas, framesCas, error: credentials_error } = useCredentials();
  useFrameCasLocationProvider(tabId, framesCas ?? []);
  useTitle([_("Base_ContentsInformation"), origin].filter(Boolean).join(" ― "));
  window.addEventListener(
    "pagehide",
    useCallback(
      () => void overlayExtensionMessenger.sendMessage("leave", null, tabId),
      [tabId],
    ),
  );

  if (isLoading({ siteProfile, sp_error, ops, cas, credentials_error })) {
    return <Loading />;
  }

  if (
    isSpVerifyError(sp_error) ||
    isCredentialsVerifyError(credentials_error)
  ) {
    return <Prohibition tabId={tabId} />;
  }

  // NOTE: SP と CAS のいずれかが閲覧可能なら表示する
  if (siteProfile || (cas && cas.length > 0)) {
    return <Redirect tabId={tabId} ops={ops} framesCas={framesCas} />;
  }

  const errors = [sp_error, credentials_error].filter(
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
