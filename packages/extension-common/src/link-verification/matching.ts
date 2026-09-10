import { selectByLocale } from "@originator-profile/core";
import type { WebsiteProfile } from "@originator-profile/model";
import type { OriginatorPayload } from "@originator-profile/verify";

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

/**
 * Website Profile を発行した組織の名前を得る
 *
 * NOTE: WebsiteProfile.credentialSubject はサイトの属性であり、その name は
 * サイト名 (The name of the Web site) で組織名ではない。運営者は issuer が指す
 * OP の側にある
 * @param wsp Website Profile
 * @param originators 遷移先の復号済み発信者
 */
export const resolveName = (
  wsp: WebsiteProfile,
  originators: OriginatorPayload[],
): string | undefined => {
  const op = originators.find(
    (o) => o.core?.credentialSubject.id === wsp.issuer,
  );
  return op && getOrgNameFromOp(op);
};

export const getDestinationOrgName = (
  originators: OriginatorPayload[],
  sites: (WebsiteProfile | null)[],
  targetOpId: string,
): string | undefined => {
  const present = sites.filter((wsp) => wsp !== null);
  const matchedWsp = selectByLocale(
    present.filter((wsp) => wsp.issuer === targetOpId),
  );
  if (matchedWsp) {
    return resolveName(matchedWsp, originators);
  }

  // フォールバック: 一致するものがなければ他の WSP から取得を試みる
  const fallbackWsp = selectByLocale(present);
  return fallbackWsp ? resolveName(fallbackWsp, originators) : undefined;
};

export const isMatched = (
  sites: (WebsiteProfile | null)[],
  targetOpId: string,
): boolean => {
  return sites.some((wsp) => wsp?.issuer === targetOpId);
};
