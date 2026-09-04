import type { WebsiteProfile } from "@originator-profile/model";
import type { OriginatorPayload } from "@originator-profile/verify";

export const getOrgNameFromOp = (op: OriginatorPayload): string | undefined => {
  const named = op.annotations?.find((annotation) => {
    const subject = annotation?.credentialSubject;
    return subject && "name" in subject && typeof subject.name === "string";
  });
  const subject = named?.credentialSubject;
  return subject && "name" in subject && typeof subject.name === "string"
    ? subject.name
    : undefined;
};

export const resolveName = (
  wsp: WebsiteProfile,
  originators: OriginatorPayload[],
): string | undefined => {
  const op = originators.find(
    (o) => o.core?.credentialSubject.id === wsp.issuer,
  );
  if (op) {
    const orgName = getOrgNameFromOp(op);
    if (orgName) return orgName;
  }
  // WSP名のフォールバック
  return "name" in wsp.credentialSubject
    ? wsp.credentialSubject.name
    : undefined;
};

export const getDestinationOrgName = (
  originators: OriginatorPayload[],
  sites: (WebsiteProfile | null)[],
  targetOpId: string,
): string | undefined => {
  const matchedWsp = sites.find((wsp) => wsp?.issuer === targetOpId);
  if (matchedWsp) {
    return resolveName(matchedWsp, originators);
  }

  // フォールバック: 一致するものがなければ先頭のWSPから取得を試みる
  const firstWsp = sites[0];
  return firstWsp ? resolveName(firstWsp, originators) : undefined;
};

export const isMatched = (
  sites: (WebsiteProfile | null)[],
  targetOpId: string,
): boolean => {
  return sites.some((wsp) => wsp?.issuer === targetOpId);
};
