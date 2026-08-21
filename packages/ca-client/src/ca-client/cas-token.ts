import {
  UnsignedContentAttestation as UnsignedContentAttestationSchema,
  type UnsignedContentAttestation,
} from "@originator-profile/model";
import { CaClientError, CaClientErrorCode } from "../errors";

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

  const parsed = UnsignedContentAttestationSchema.safeParse({
    "@context": payload["@context"],
    type: payload.type,
    issuer,
    credentialSubject: payload.credentialSubject,
    allowedUrl: payload.allowedUrl,
    target: payload.target,
  });
  if (!parsed.success) {
    throw new CaClientError(
      `Invalid Content Attestation: invalid payload in ${source}: ${parsed.error.message}`,
      { code: CaClientErrorCode.Validation, cause: parsed.error },
    );
  }
  return parsed.data;
};
