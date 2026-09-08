import { CaClientError, CaClientErrorCode } from "../errors";
import { isRecord } from "../is-record";

export const decodeJwtPayload = (token: string): Record<string, unknown> => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new CaClientError(
      `Invalid JWT: expected 3 parts, got ${parts.length}`,
      { code: CaClientErrorCode.Validation },
    );
  }

  const [, payload] = parts;
  if (!payload) {
    throw new CaClientError("Invalid JWT: empty payload", {
      code: CaClientErrorCode.Validation,
    });
  }

  let parsed: unknown;
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    parsed = JSON.parse(decoded);
  } catch (error) {
    throw new CaClientError("Failed to decode JWT payload", {
      code: CaClientErrorCode.Validation,
      cause: error,
    });
  }

  if (!isRecord(parsed)) {
    throw new CaClientError("Failed to decode JWT payload", {
      code: CaClientErrorCode.Validation,
    });
  }

  return parsed;
};

export const getJwtExpiration = (token: string): number | undefined => {
  try {
    const payload = decodeJwtPayload(token);
    const exp = payload.exp;
    if (typeof exp === "number") {
      return exp;
    }
    return undefined;
  } catch {
    return undefined;
  }
};
