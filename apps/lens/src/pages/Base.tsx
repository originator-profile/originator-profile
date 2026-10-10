import {
  FramesVerifiedCas,
  SupportedVerifiedCas,
  overlayExtensionMessenger,
} from "@originator-profile/extension-common";
import {
  SiteProfileFetchFailed,
  SiteProfileFetchInvalid,
} from "@originator-profile/presentation";
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
import { Navigate, useLocation } from "react-router";
import { useMount } from "react-use";
import { useCredentials } from "../components/credentials";
import Loading from "../components/Loading";
import { useSiteProfile } from "../components/siteProfile";
import Unsupported from "../components/Unsupported";
import { buildPublUrl, routes } from "../utils/routes";

/** CA のないまま site 画面に着地したことを示す遷移の state */
const LANDED_WITHOUT_CA = "landed-without-ca";

function Redirect({
  tabId,
  ops,
  framesCas,
  replace,
}: {
  tabId: number;
  ops?: VerifiedOps;
  framesCas?: FramesVerifiedCas;
  replace?: boolean;
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

  return (
    <Navigate
      to={buildPublUrl(tabId, ca?.attestation.doc)}
      replace={replace}
      state={ca ? undefined : LANDED_WITHOUT_CA}
    />
  );
}

/**
 * CA のないまま着地した site 画面で、後から CA が届いたら publ 画面へ遷移し直す
 *
 * 文書の検証結果は文書ごとに届くため、着地した後に確定する文書の CA もある。
 * 利用者が自分で移った画面は変えない。
 */
export function FollowLanding() {
  const { state } = useLocation();
  const { tabId, ops, cas, framesCas } = useCredentials();
  if (state !== LANDED_WITHOUT_CA || !cas || cas.length === 0) return null;
  return <Redirect tabId={tabId} ops={ops} framesCas={framesCas} replace />;
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
      | OpsInvalid => {
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
