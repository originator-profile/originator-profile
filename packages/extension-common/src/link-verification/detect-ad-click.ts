import { selectByLocale } from "@originator-profile/core";
import {
  ContentAttestation,
  ContentAttestationSet,
  ContentAttestationSetItem,
  OpMeta,
  OriginatorProfileSet,
  WebMediaProfile,
} from "@originator-profile/model";
import {
  CredentialsFetchFailed,
  fetchCredentials,
  fetchOpMeta,
} from "@originator-profile/presentation";
import { JwtVcDecoder } from "@originator-profile/securing-mechanism";
import { decodeOps, normalizeCasItem } from "@originator-profile/verify";
import { linkVerificationMessenger } from "./events";
import type { OrgRef, VerificationContext } from "./types";

/**
 * 同一タブでの通常のナビゲーションを起こさないスキーム
 *
 * NOTE: 遷移しないなら新規タブが開かれたとみなす推定であり、href="#" や
 * preventDefault() で window.open() を呼ぶ実装は拾えない (#517)
 */
const NON_NAVIGATING_SCHEMES: readonly string[] = [
  "javascript:",
  "data:",
  "vbscript:",
];

/** リンクの活性化が新規タブを開くとみなせるか */
const opensInNewTab = (
  anchor: HTMLAnchorElement,
  e: MouseEvent | KeyboardEvent,
): boolean =>
  anchor.target === "_blank" ||
  e.ctrlKey ||
  e.metaKey ||
  e.shiftKey ||
  ("button" in e && e.button === 1) ||
  NON_NAVIGATING_SCHEMES.includes(anchor.protocol);

const AD_CA_TYPES = ["OnlineAd", "Advertorial"] as const;
type AdCaType = (typeof AD_CA_TYPES)[number];

const isAdCaType = (type: string | undefined): type is AdCaType => {
  return type !== undefined && AD_CA_TYPES.includes(type as AdCaType);
};

const decodeCa = JwtVcDecoder<ContentAttestation>();

const decodeCasItem = (casItem: ContentAttestationSetItem) => {
  const jwt = normalizeCasItem(casItem).attestation;
  if (typeof jwt !== "string") return undefined;
  const decoded = decodeCa(jwt);
  if (decoded instanceof Error) {
    console.error("[ContentScript] Failed to decode CA", decoded);
    return undefined;
  }
  return decoded.doc;
};

// 広告関連CA(OnlineAd/Advertorial)のissuerを取得
const getAdCaIssuer = (cas: ContentAttestationSet): string | undefined => {
  for (const casItem of cas) {
    const doc = decodeCasItem(casItem);
    if (doc && isAdCaType(doc.credentialSubject.type)) {
      return doc.issuer;
    }
  }
  return undefined;
};

/** OP ごとに、閲覧者のロケールに合う Web Media Profile を選ぶ */
const selectWebMediaProfiles = (
  ops: OriginatorProfileSet,
): WebMediaProfile[] => {
  const decoded = decodeOps(ops);
  if (decoded instanceof Error) {
    console.error(
      "[ContentScript] Failed to decode Originator Profile Set",
      decoded,
    );
    return [];
  }
  return decoded.flatMap((op) => {
    const wmp = op.media && selectByLocale(op.media.map(({ doc }) => doc));
    return wmp ? [wmp] : [];
  });
};

/**
 * OP ID に組織名を添える
 *
 * NOTE: 突き合わせる相手は WMP の credentialSubject.id である。issuer は OP の
 * 発行者を指すため、広告 CA の issuer とも targetopid とも一致しない
 * @param wmps OP ごとに選ばれた Web Media Profile
 * @param id OP ID
 */
const toOrgRef = (wmps: WebMediaProfile[], id: string): OrgRef => ({
  id,
  name: wmps.find((wmp) => wmp.credentialSubject.id === id)?.credentialSubject
    .name,
});

/**
 * 広告リンクのクリックを検知して Service Worker へ通知する
 *
 * 全フレームで呼ぶ。opmeta が設置されたフレームでのみ働く。
 */
export function setupAdClickDetection() {
  let cachedContext: VerificationContext | undefined;

  const tryCacheContext = () => {
    const opMeta = fetchOpMeta(document);
    if (!opMeta) return;

    void fetchCredentials(document)
      .then(({ ops, cas }) => {
        if (ops instanceof CredentialsFetchFailed) return;
        const wmps = selectWebMediaProfiles(ops);
        const adCaIssuer =
          cas instanceof CredentialsFetchFailed
            ? undefined
            : getAdCaIssuer(cas);
        cachedContext = {
          source: adCaIssuer ? toOrgRef(wmps, adCaIssuer) : undefined,
          expectedOperator: toOrgRef(wmps, opMeta.targetopid),
        };
      })
      .catch((e) => {
        console.error("[ContentScript] Pre-fetch credentials failed", e);
      });
  };

  tryCacheContext();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryCacheContext, {
      once: true,
    });
  }

  const sendAdClicked = (opMeta: OpMeta, isNewTab: boolean) => {
    void linkVerificationMessenger.sendMessage("adClicked", {
      source: cachedContext?.source,
      // NOTE: 先読みが間に合っていなくても照合はできるよう、OP ID はクリック時の
      // opMeta から採る。組織名は先読みできていなければ付かない
      expectedOperator: {
        id: opMeta.targetopid,
        name: cachedContext?.expectedOperator.name,
      },
      isNewTab,
    });
  };

  const handleAnchorActivation = (e: MouseEvent | KeyboardEvent) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor) return;
    const opMeta = fetchOpMeta(document);
    if (!opMeta) return;
    sendAdClicked(opMeta, opensInNewTab(anchor, e));
  };

  const handleSpaceKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const tagName = target.tagName;
    const role = target.getAttribute("role");
    const isButtonOrInput =
      tagName === "BUTTON" ||
      tagName === "INPUT" ||
      tagName === "SELECT" ||
      tagName === "TEXTAREA" ||
      role === "button";

    if (isButtonOrInput) {
      const opMeta = fetchOpMeta(document);
      if (opMeta) {
        sendAdClicked(opMeta, false);
      }
    }
  };

  document.addEventListener("click", handleAnchorActivation);
  document.addEventListener("mousedown", (e: MouseEvent) => {
    // ミドルクリックは click を発火せず auxclick を発火するため、ここで拾う
    if (e.button === 1) {
      handleAnchorActivation(e);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleAnchorActivation(e);
      return;
    }
    if (e.key === " " || e.key === "Spacebar") {
      handleSpaceKey(e);
    }
  });
}
