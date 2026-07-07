import type {
  Jwk,
  UnsignedContentAttestation,
} from "@originator-profile/model";
import { signJwtVc } from "@originator-profile/securing-mechanism";
import type { HashAlgorithm } from "websri";
import {
  type DocumentProvider,
  fetchAndSetDigestSri,
  fetchAndSetTargetIntegrity,
} from "./integrity/";

/**
 * Content Attestation への署名
 * @param uca 未署名 Content Attestation オブジェクト
 * @param privateKey プライベート鍵
 * @return JWT でエンコードされた Content Attestation
 */
export async function signCa(
  uca: UnsignedContentAttestation,
  privateKey: Jwk,
  {
    alg = "ES256",
    issuedAt = new Date(),
    expiredAt,
    integrityAlg = "sha256",
    documentProvider = async () => document,
  }: {
    alg?: string;
    issuedAt?: Date;
    expiredAt: Date;
    integrityAlg?: HashAlgorithm;
    documentProvider?: DocumentProvider;
  },
): Promise<string> {
  await fetchAndSetDigestSri(integrityAlg, uca.credentialSubject.image);
  await fetchAndSetTargetIntegrity(integrityAlg, uca, documentProvider);

  const { id } = uca.credentialSubject;
  if (id === undefined) {
    throw new Error(
      "credentialSubject.id is required to sign a Content Attestation.",
    );
  }

  return await signJwtVc(
    { ...uca, credentialSubject: { ...uca.credentialSubject, id } },
    privateKey,
    { alg, issuedAt, expiredAt },
  );
}
