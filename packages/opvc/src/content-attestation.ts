import { parseExpirationDate } from "@originator-profile/core";
import {
  UnsignedContentAttestation,
  type Jwk,
} from "@originator-profile/model";
import {
  fetchAndSetDigestSri,
  fetchAndSetTargetIntegrity,
  signCa,
  type DocumentProvider,
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

function assertValidDate(
  value: Date,
  fieldName: "issuedAt" | "expiredAt",
): void {
  if (Number.isNaN(value.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid date.`);
  }
}

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
      : new Date(expiredAtDateOrString);

  assertValidDate(issuedAt, "issuedAt");
  assertValidDate(expiredAt, "expiredAt");

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
    ...uca,
    iss: uca.issuer,
    sub: uca.credentialSubject.id,
    iat: getUnixTime(issuedAt),
    exp: getUnixTime(expiredAt),
  };
}

/**
 * Content Attestation への署名
 * @param uca 未署名 Content Attestation オブジェクト
 * @param privateKey プライベート鍵
 * @throws {Error} 入力が UnsignedContentAttestation スキーマに適合しない場合
 * @return Content Attestation
 */
export async function sign(
  uca: UnsignedContentAttestation,
  privateKey: Jwk,
  options: ContentAttestationTimingOptions = {},
): Promise<string> {
  UnsignedContentAttestation.parse(uca);

  const { issuedAt, expiredAt } = parseDates(options);

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
 * @throws {Error} 入力が UnsignedContentAttestation スキーマに適合しない場合
 * @throws {BadRequestError} 検証対象のコンテンツが存在しない/コンテンツにアクセスできない/Integrityの計算に失敗
 * @return 未署名 Content Attestation オブジェクト
 */
export async function unsignedCa(
  uca: UnsignedContentAttestation,
  options: UnsignedCaOptions,
): Promise<UnsignedContentAttestation> {
  UnsignedContentAttestation.parse(uca);

  return await prepareUnsignedCa(uca, options);
}

/**
 * CA server 経由で Content Attestation を作成
 * @param uca 未署名 Content Attestation オブジェクト
 * @param options Content Attestation の生成オプション
 * @param options.endpoint CA server のエンドポイント URL
 * @param options.accessToken CA server 呼び出しに利用する Bearer トークン
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
    const responseBody = await response.text();
    throw new Error(
      `CA API error: ${response.status} ${response.statusText}: ${responseBody}`,
    );
  }

  const responseBody = (await response.text()).trim();
  if (responseBody === "") {
    throw new Error("CA API returned no JWT.");
  }

  let result: unknown;
  try {
    result = JSON.parse(responseBody) as unknown;
  } catch {
    return responseBody;
  }

  if (typeof result === "string") {
    return result;
  }

  if (Array.isArray(result) && typeof result[0] === "string") {
    return result[0];
  }

  throw new Error("CA API returned no JWT.");
}
