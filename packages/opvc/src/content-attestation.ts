import { parseExpirationDate } from "@originator-profile/core";
import type {
  Jwk,
  UnsignedContentAttestation,
} from "@originator-profile/model";
import {
  type DocumentProvider,
  fetchAndSetDigestSri,
  fetchAndSetTargetIntegrity,
  signCa,
} from "@originator-profile/sign";
import { addYears, getUnixTime } from "date-fns";
import { BadRequestError } from "http-errors-enhanced";
import type { HashAlgorithm } from "websri";
import { documentProvider as defaultDocumentProvider } from "./document-provider.ts";

type ContentAttestationTimingOptions = {
  issuedAt?: Date | string;
  expiredAt?: Date | string;
};

type UnsignedCaOptions = ContentAttestationTimingOptions & {
  integrityAlg?: HashAlgorithm;
  documentProvider?: DocumentProvider;
};

function parseDates({
  issuedAt: issuedAtDateOrString = new Date(),
  expiredAt: expiredAtDateOrString = addYears(new Date(), 1),
}: ContentAttestationTimingOptions): {
  issuedAt: Date;
  expiredAt: Date;
} {
  const issuedAt: Date = new Date(issuedAtDateOrString);

  const expiredAt: Date =
    typeof expiredAtDateOrString === "string"
      ? parseExpirationDate(expiredAtDateOrString)
      : expiredAtDateOrString;

  return { issuedAt, expiredAt };
}

async function prepareUnsignedCa(
  uca: UnsignedContentAttestation,
  {
    integrityAlg = "sha256",
    documentProvider = defaultDocumentProvider,
    ...timingOptions
  }: UnsignedCaOptions,
): Promise<UnsignedContentAttestation> {
  const { issuedAt, expiredAt } = parseDates(timingOptions);

  uca.credentialSubject.id ??= `urn:uuid:${crypto.randomUUID()}`;

  try {
    await fetchAndSetDigestSri(integrityAlg, uca.credentialSubject.image);
    await fetchAndSetTargetIntegrity(integrityAlg, uca, documentProvider);
  } catch (e) {
    throw new BadRequestError((e as Error).message);
  }

  return {
    iss: uca.issuer,
    sub: uca.credentialSubject.id,
    iat: getUnixTime(issuedAt),
    exp: getUnixTime(expiredAt),
    ...uca,
  };
}

/**
 * Content Attestation への署名
 * @param uca 未署名 Content Attestation オブジェクト
 * @param privateKey プライベート鍵
 * @return Content Attestation
 */
export async function sign(
  uca: UnsignedContentAttestation,
  privateKey: Jwk,
  {
    issuedAt: issuedAtDateOrString = new Date(),
    expiredAt: expiredAtDateOrString = addYears(new Date(), 1),
  }: {
    issuedAt?: Date | string;
    expiredAt?: Date | string;
  },
): Promise<string> {
  const issuedAt: Date = new Date(issuedAtDateOrString);

  const expiredAt: Date =
    typeof expiredAtDateOrString === "string"
      ? parseExpirationDate(expiredAtDateOrString)
      : expiredAtDateOrString;

  uca.credentialSubject.id ??= `urn:uuid:${crypto.randomUUID()}`;

  return await signCa(uca, privateKey, {
    issuedAt,
    expiredAt,
    documentProvider: defaultDocumentProvider,
  });
}

/**
 * 未署名 Content Attestation の取得
 * @param uca 未署名 Content Attestation オブジェクト
 * @throws {BadRequestError} 検証対象のコンテンツが存在しない/コンテンツにアクセスできない/Integrityの計算に失敗
 * @return 未署名 Content Attestation オブジェクト
 */
export async function unsignedCa(
  uca: UnsignedContentAttestation,
  options: UnsignedCaOptions,
): Promise<UnsignedContentAttestation> {
  return await prepareUnsignedCa(uca, options);
}

/**
 * CA server 経由で Content Attestation を作成
 * @param uca 未署名 Content Attestation オブジェクト
 * @return JWT でエンコードされた Content Attestation
 */
export async function signByServer(
  uca: UnsignedContentAttestation,
  {
    endpoint,
    accessToken,
    ...options
  }: UnsignedCaOptions & {
    endpoint: string;
    accessToken: string;
  },
): Promise<string> {
  const payload = await prepareUnsignedCa(uca, options);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`CA API error: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as unknown;
  if (typeof result === "string") {
    return result;
  }

  if (Array.isArray(result) && typeof result[0] === "string") {
    return result[0];
  }

  throw new Error("CA API returned no JWT.");
}
