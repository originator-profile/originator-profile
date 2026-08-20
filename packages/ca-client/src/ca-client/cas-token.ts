import type { UnsignedContentAttestation } from "@originator-profile/model";
import {
  JwtVcDecoder,
  VcDecodeFailed,
} from "@originator-profile/securing-mechanism";
import { CaClientError, CaClientErrorCode } from "../errors";

const jwtVcDecoder = JwtVcDecoder();

export const decodeCasVc = (token: string): Record<string, unknown> => {
  const decoded = jwtVcDecoder(token);
  if (decoded instanceof VcDecodeFailed) {
    throw new CaClientError(
      `Invalid CAS: failed to decode JWT: ${decoded.message}`,
      {
        code: CaClientErrorCode.Validation,
        cause: decoded,
      },
    );
  }
  return decoded.doc;
};

export const parseCasTokenFromFileContent = (
  fileContent: string,
  source: string,
): string => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new CaClientError(
      `Invalid CAS: failed to parse JSON in ${source}: ${detail}`,
      { code: CaClientErrorCode.Validation, cause: err },
    );
  }
  if (!Array.isArray(parsed) || typeof parsed[0] !== "string") {
    throw new CaClientError(
      `Invalid CAS: invalid file format in ${source} (expected JSON array with JWT string)`,
      { code: CaClientErrorCode.Validation },
    );
  }

  return parsed[0];
};

const JWT_PAYLOAD_CONTENT_ATTESTATION_KEYS = [
  "@context",
  "type",
  "issuer",
  "credentialSubject",
  "allowedUrl",
  "target",
] as const;

const assertJwtPayloadHasContentAttestationKeys = (
  payload: Record<string, unknown>,
  source: string,
) => {
  const missingKeys = JWT_PAYLOAD_CONTENT_ATTESTATION_KEYS.filter(
    (key) => payload[key] === undefined || payload[key] === null,
  );
  if (missingKeys.length > 0) {
    throw new CaClientError(
      `Invalid Content Attestation: missing required keys in ${source}: ${missingKeys.join(", ")}`,
      { code: CaClientErrorCode.Validation },
    );
  }
};

export type JwtPayloadToUnsignedCaOptions = {
  issuer?: string;
};

export const jwtPayloadToUnsignedCa = (
  payload: Record<string, unknown>,
  source: string,
  options?: JwtPayloadToUnsignedCaOptions,
): UnsignedContentAttestation => {
  assertJwtPayloadHasContentAttestationKeys(payload, source);

  const issuer =
    options?.issuer !== undefined ? options.issuer : payload.issuer;

  return {
    "@context": payload["@context"],
    type: payload.type,
    issuer,
    credentialSubject: payload.credentialSubject,
    allowedUrl: payload.allowedUrl,
    target: payload.target,
  } as UnsignedContentAttestation;
};
