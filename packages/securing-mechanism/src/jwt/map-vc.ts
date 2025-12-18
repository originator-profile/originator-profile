import { Jwk, OpVc } from "@originator-profile/model";
import { fromUnixTime } from "date-fns";
import { JWTPayload, ProtectedHeaderParameters } from "jose";
import { UnverifiedJwtVc, VerifiedJwtVc } from "./types";

export function toUnverifiedJwtVc<T extends OpVc>(
  payload: JWTPayload,
  protectedHeader: ProtectedHeaderParameters,
  jwt: string,
): UnverifiedJwtVc<T> {
  const {
    aud: _aud,
    exp,
    iat,
    iss: _iss,
    jti: _jti,
    nbf: _nbf,
    sub: _sub,
    ...rest
  } = payload;
  const { alg, typ } = protectedHeader;
  const doc = rest as T;
  return {
    doc,
    issuedAt: iat ? fromUnixTime(iat) : undefined,
    expiredAt: exp ? fromUnixTime(exp) : undefined,
    mediaType: typ && `application/${typ}`,
    algorithm: alg,
    source: jwt,
  };
}

export function toVerifiedJwtVc<T extends OpVc>(
  payload: JWTPayload,
  protectedHeader: ProtectedHeaderParameters,
  jwt: string,
  key: Jwk,
): VerifiedJwtVc<T> {
  const unverified = toUnverifiedJwtVc<T>(payload, protectedHeader, jwt);
  const verificationKey = {
    ...key,
    kid: protectedHeader.kid,
  } as Jwk;
  return { ...unverified, verificationKey, validated: false };
}
