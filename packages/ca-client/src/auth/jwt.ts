import { CaClientError, CaClientErrorCode } from "../errors";

export const decodeJwtPayload = (token: string): Record<string, unknown> => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new CaClientError(
      `Invalid JWT: expected 3 parts, got ${parts.length}`,
      { code: CaClientErrorCode.Validation },
    );
  }

  try {
    const payload = parts[1];
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch (error) {
    throw new CaClientError("Failed to decode JWT payload", {
      code: CaClientErrorCode.Validation,
      cause: error,
    });
  }
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
