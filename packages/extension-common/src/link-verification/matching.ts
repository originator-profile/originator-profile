import { selectByLocale } from "@originator-profile/core";
import type { WebsiteProfile } from "@originator-profile/model";
import type { OriginatorPayload } from "@originator-profile/verify";
import type { OrgRef } from "./types";

/**
 * 発信者の組織名を得る
 *
 * NOTE: 組織名を持つのは Web Media Profile だけである。Profile Annotation の
 * name は PA 自体の名前で、組織名は JapaneseExistencePA などの corporateName
 * にしかない
 * @param op 復号済みの発信者
 */
export const getOrgNameFromOp = (op: OriginatorPayload): string | undefined => {
  const media = op.media?.filter((wmp) => wmp !== null) ?? [];
  return selectByLocale(media)?.credentialSubject.name;
};

/** Website Profile を発行した組織の名前を得る */
export const resolveName = (
  wsp: WebsiteProfile,
  originators: OriginatorPayload[],
): string | undefined => {
  const op = originators.find(
    (o) => o.core?.credentialSubject.id === wsp.issuer,
  );
  return op && getOrgNameFromOp(op);
};

/**
 * 実際にサイトを運営している組織を得る
 * @param originators 遷移先の復号済み発信者
 * @param sites 検証を通過した Website Profile
 * @param expectedOpId targetopid が表明する、期待される運営者の OP ID
 */
export const resolveActualOperator = (
  originators: OriginatorPayload[],
  sites: (WebsiteProfile | null)[],
  expectedOpId: string,
): OrgRef | undefined => {
  const present = sites.filter((wsp) => wsp !== null);
  const wsp =
    selectByLocale(present.filter((w) => w.issuer === expectedOpId)) ??
    // フォールバック: 一致するものがなければ他の WSP から取得を試みる
    selectByLocale(present);
  return wsp && { id: wsp.issuer, name: resolveName(wsp, originators) };
};

export const isMatched = (
  sites: (WebsiteProfile | null)[],
  expectedOpId: string,
): boolean => {
  return sites.some((wsp) => wsp?.issuer === expectedOpId);
};
