import {
  JwtVcDecoder,
  VcDecodeFailed,
} from "@originator-profile/securing-mechanism";
import { CaClientError, CaClientErrorCode } from "../errors.ts";

const jwtVcDecoder = JwtVcDecoder();

export type DecodedCa = {
  jwt: string;
  payload: Record<string, unknown>;
  expiresAt?: Date;
};

/** Decode a CA JWT. JWT registered claims are stripped from `payload`. */
export const decodeCa = (jwt: string): DecodedCa => {
  const decoded = jwtVcDecoder(jwt);
  if (decoded instanceof VcDecodeFailed) {
    throw new CaClientError(`Failed to decode CAS JWT: ${decoded.message}`, {
      code: CaClientErrorCode.Validation,
      cause: decoded,
    });
  }
  return decoded.expiredAt === undefined
    ? { jwt, payload: decoded.doc }
    : { jwt, payload: decoded.doc, expiresAt: decoded.expiredAt };
};
