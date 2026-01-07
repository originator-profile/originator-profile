import type { WebMediaProfile } from "@originator-profile/model";
import type { VerifiedOps } from "@originator-profile/verify";
import { useMemo } from "react";

/**
 * @contextから@languageタグを取得
 */
function getLanguage(vc: { "@context": unknown }): string | undefined {
  const context = vc["@context"];
  if (!Array.isArray(context)) return undefined;

  for (const item of context) {
    if (typeof item === "object" && item !== null && "@language" in item) {
      return item["@language"] as string;
    }
  }
  return undefined;
}

/**
 * ユーザーロケールに基づいてVCを選択
 */
function selectByLocale<T extends { "@context": unknown }>(
  items: T[],
): T | undefined {
  if (items.length === 0) return undefined;
  if (items.length === 1) return items[0];

  const userLocale =
    typeof navigator !== "undefined" ? navigator.language.split("-")[0] : "en";

  const byLocale = items.find((item) => getLanguage(item) === userLocale);
  if (byLocale) return byLocale;

  const byEn = items.find((item) => getLanguage(item) === "en");
  if (byEn) return byEn;

  return items[0];
}

export function useProfileAnnotatorWmp(
  ops: VerifiedOps,
  profileAnnotatorOpId: string,
): WebMediaProfile | undefined {
  const profileAnnotatorOp = useMemo(
    () =>
      ops.find((op) =>
        op.media?.some(
          (m) => m.doc.credentialSubject.id === profileAnnotatorOpId,
        ),
      ),
    [ops, profileAnnotatorOpId],
  );
  const selectedWmp = useMemo(() => {
    if (!profileAnnotatorOp?.media) return undefined;
    return selectByLocale(profileAnnotatorOp.media.map((m) => m.doc));
  }, [profileAnnotatorOp]);
  return selectedWmp;
}
