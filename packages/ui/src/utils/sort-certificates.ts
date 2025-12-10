import { VerifiedVc } from "@originator-profile/securing-mechanism";
import { Certificate } from "@originator-profile/verify";

const certificationSystemIdPriorityMap: Record<string, number> = {
  "urn:uuid:def09cbd-6e8e-4c73-856d-5e00dffde643": 1, // Fictitious Organization Existence Verification Agency Existence Certificate
  "urn:uuid:203a2553-f1a8-40ba-9df0-4e508aa8511d": 2, // Fictitious Local Government Authentication Center Local Government Certificate
  "urn:uuid:2dbf9afe-af9c-4c6a-b6df-70a9565fec5e": 3, // Fictitious News Media Organization Registration Center Registration Certificate
  "urn:uuid:8029ece0-b327-4a7e-b586-3e442cb82d92": 4, // Fictitious Advertisement Certification Center Brand Safety Certified
  "urn:uuid:85c92abe-4518-42bb-855d-dffeabfe4a38": 5, // Fictitious Advertisement Certification Center Certified Against Ad Fraud
};

const DEFAULT_PRIORITY = 999;

const getPriority = (id: string): number => {
  return certificationSystemIdPriorityMap[id] ?? DEFAULT_PRIORITY;
};

/**
 * PA を certificationSystem.id の優先度順に並び替えます。
 *
 * @param certificates - 並び替える PA の配列
 * @returns  優先度順にソートされた新しい PA の配列
 *
 * マップに存在しない id はすべて DEFAULT_PRIORITY で下位に並びます。
 */
export default function sortCertificates(
  certificates: VerifiedVc<Certificate>[],
) {
  return [...certificates].sort((a, b) => {
    const priorityA = getPriority(
      a.doc.credentialSubject.certificationSystem.id,
    );
    const priorityB = getPriority(
      b.doc.credentialSubject.certificationSystem.id,
    );
    return priorityA - priorityB;
  });
}
