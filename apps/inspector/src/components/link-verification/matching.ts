import {
  VerifiedOp,
  VerifiedOps,
  VerifiedSp,
} from "@originator-profile/verify";

/** 検証済み Website Profile */
export type VerifiedWsp = VerifiedSp["sites"][number];

export const getOrgNameFromOp = (op: VerifiedOp): string | undefined => {
  const annotationWithName = op.annotations?.find(
    (a) =>
      "name" in a.doc.credentialSubject &&
      typeof a.doc.credentialSubject.name === "string",
  );
  if (annotationWithName) {
    return (annotationWithName.doc.credentialSubject as { name: string }).name;
  }
  return undefined;
};

export const resolveName = (
  wsp: VerifiedWsp,
  originators: VerifiedOps,
): string | undefined => {
  const op = originators.find(
    (o) => o.core.doc.credentialSubject.id === wsp.doc.issuer,
  );
  if (op) {
    const orgName = getOrgNameFromOp(op);
    if (orgName) return orgName;
  }
  // WSP名のフォールバック
  if ("name" in wsp.doc.credentialSubject) {
    return wsp.doc.credentialSubject.name;
  }
  return undefined;
};

export const getDestinationOrgName = (
  originators: VerifiedOps,
  sites: VerifiedWsp[],
  targetOpId: string,
): string | undefined => {
  // targetOpIdに一致するWSPを検索
  const matchedWsp = sites.find((wsp) => wsp.doc.issuer === targetOpId);
  if (matchedWsp) {
    return resolveName(matchedWsp, originators);
  }

  // フォールバック: 一致するものがなければ先頭のWSPから取得を試みる
  const firstWsp = sites[0];
  return firstWsp ? resolveName(firstWsp, originators) : undefined;
};

export const isMatched = (
  sites: VerifiedWsp[],
  targetOpId: string,
): boolean => {
  return sites.some((wsp) => wsp.doc.issuer === targetOpId);
};
