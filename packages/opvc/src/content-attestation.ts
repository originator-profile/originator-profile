import { UnsignedContentAttestation } from "@originator-profile/model";
import type {
  JwtSigner,
  KeyMaterial,
} from "@originator-profile/securing-mechanism";
import {
  fetchAndSetDigestSri,
  fetchAndSetTargetIntegrity,
  signCa,
  type DocumentProvider,
} from "@originator-profile/sign";
import { getUnixTime } from "date-fns";
import { BadRequestError } from "http-errors-enhanced";
import type { HashAlgorithm } from "websri";
import { documentProvider as defaultDocumentProvider } from "./document-provider.ts";
import { parseDates, type TimingOptions } from "./timing-options.ts";

type UnsignedCaOptions = TimingOptions & {
  integrityAlg?: HashAlgorithm;
  documentProvider?: DocumentProvider;
  /**
   * 入力に credentialSubject.id が無い場合に urn:uuid を採番するか。
   * @default true
   */
  assignId?: boolean;
};

/**
 * 未署名 Content Attestation の取得
 * @param uca 未署名 Content Attestation オブジェクト
 * @throws {BadRequestError} 入力が UnsignedContentAttestation スキーマに適合しない場合/検証対象のコンテンツが存在しない/コンテンツにアクセスできない/Integrityの計算に失敗
 * @return 未署名 Content Attestation オブジェクト
 */
export async function unsignedCa(
  uca: UnsignedContentAttestation,
  {
    integrityAlg = "sha256",
    documentProvider = defaultDocumentProvider,
    assignId = true,
    ...timingOptions
  }: UnsignedCaOptions,
): Promise<UnsignedContentAttestation> {
  const { issuedAt, expiredAt } = parseDates(timingOptions);
  if (assignId) {
    uca.credentialSubject.id ??= `urn:uuid:${crypto.randomUUID()}`;
  }

  try {
    UnsignedContentAttestation.parse(uca);

    await Promise.all([
      fetchAndSetDigestSri(integrityAlg, uca.credentialSubject.image),
      fetchAndSetTargetIntegrity(integrityAlg, uca, documentProvider),
    ]);
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
 * @param signer プライベート鍵、または HSM・KMS・WebAuthn等の外部署名者 (JwtSigner)
 * @throws {BadRequestError} 入力が UnsignedContentAttestation スキーマに適合しない場合/検証対象のコンテンツが存在しない/コンテンツにアクセスできない/Integrityの計算に失敗
 * @return Content Attestation
 */
export async function sign(
  uca: UnsignedContentAttestation,
  signer: KeyMaterial | JwtSigner,
  options: TimingOptions = {},
): Promise<string> {
  const { issuedAt, expiredAt } = parseDates(options);
  const payload = await unsignedCa(uca, { issuedAt, expiredAt });

  return await signCa(payload, signer, {
    issuedAt,
    expiredAt,
    documentProvider: defaultDocumentProvider,
  });
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
  const { issuedAt, expiredAt } = parseDates(options);
  const payload = await unsignedCa(uca, {
    ...options,
    issuedAt,
    expiredAt,
    assignId: false,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      ...payload,
      issuedAt: issuedAt.toISOString(),
      expiredAt: expiredAt.toISOString(),
    }),
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
