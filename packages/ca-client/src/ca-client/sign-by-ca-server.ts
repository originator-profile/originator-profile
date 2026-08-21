import {
  UnsignedContentAttestation as UnsignedContentAttestationSchema,
  type UnsignedContentAttestation,
} from "@originator-profile/model";
import {
  fetchAndSetDigestSri,
  fetchAndSetTargetIntegrity,
  type DocumentProvider,
} from "@originator-profile/sign";
import { CaClientError, CaClientErrorCode } from "../errors";
import type { FetchOperations } from "../fetch-operations";
import { parseDates, toUnixTime, type TimingOptions } from "./dates";
import { documentProvider as defaultDocumentProvider } from "./document-provider";

export type SignByCaServerOptions = TimingOptions & {
  endpoint: string;
  accessToken: string;
  documentProvider?: DocumentProvider;
  fetchOps?: FetchOperations;
};

function jwtFromCaResponse(body: string): string {
  const responseBody = body.trim();
  if (responseBody === "") {
    throw new CaClientError("CA signing failed: empty response", {
      code: CaClientErrorCode.Response,
    });
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

  throw new CaClientError("CA signing failed: response did not contain a JWT", {
    code: CaClientErrorCode.Response,
  });
}

export async function signByCaServer(
  uca: UnsignedContentAttestation,
  {
    endpoint,
    accessToken,
    documentProvider,
    fetchOps = { fetch },
    ...timingOptions
  }: SignByCaServerOptions,
): Promise<string> {
  const { issuedAt, expiredAt } = parseDates(timingOptions);
  const resolveDocument =
    documentProvider ?? ((raw) => defaultDocumentProvider(raw, fetchOps));

  let payload: UnsignedContentAttestation;
  try {
    payload = UnsignedContentAttestationSchema.parse(structuredClone(uca));
    const subject = payload.credentialSubject as { image?: unknown };
    await Promise.all([
      fetchAndSetDigestSri("sha256", subject.image),
      fetchAndSetTargetIntegrity("sha256", payload, resolveDocument),
    ]);
  } catch (error) {
    if (error instanceof CaClientError) {
      throw error;
    }
    throw new CaClientError(
      `Invalid Content Attestation: ${error instanceof Error ? error.message : String(error)}`,
      { code: CaClientErrorCode.Validation, cause: error },
    );
  }

  const subjectId = payload.credentialSubject.id;

  let response: Response;
  try {
    response = await fetchOps.fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        ...payload,
        iss: payload.issuer,
        ...(subjectId !== undefined ? { sub: subjectId } : {}),
        iat: toUnixTime(issuedAt),
        exp: toUnixTime(expiredAt),
        issuedAt: issuedAt.toISOString(),
        expiredAt: expiredAt.toISOString(),
      }),
    });
  } catch (error) {
    throw new CaClientError(
      `CA signing failed: ${error instanceof Error ? error.message : String(error)}`,
      { code: CaClientErrorCode.Http, cause: error },
    );
  }

  if (!response.ok) {
    const responseBody = await response.text();
    throw new CaClientError(
      `CA signing failed: ${response.status} ${response.statusText}: ${responseBody}`,
      { code: CaClientErrorCode.Http, status: response.status },
    );
  }

  return jwtFromCaResponse(await response.text());
}
