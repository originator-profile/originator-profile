import { decodeJwtPayload } from "../auth/jwt";
import { CaClientError, CaClientErrorCode } from "../errors";
import { isRecord } from "../is-record";

export type CasItem = string | { attestation: string; [key: string]: unknown };

export type Cas = CasItem[];

export type CaEntry = {
  jwt: string;
  payload: Record<string, unknown>;
};

export type Recorded = { id?: string; selector?: string };

const INVALID_CAS_FORMAT =
  "Invalid CAS file format (expected JSON array with JWT string)";

const isCasItem = (value: unknown): value is CasItem => {
  if (typeof value === "string") {
    return true;
  }
  return isRecord(value) && typeof value.attestation === "string";
};

export const parseCas = (content: string): Cas => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CaClientError(detail, {
      code: CaClientErrorCode.Validation,
      cause: error,
    });
  }

  if (!Array.isArray(parsed) || !parsed.every(isCasItem)) {
    throw new CaClientError(INVALID_CAS_FORMAT, {
      code: CaClientErrorCode.Validation,
    });
  }

  return parsed;
};

export const serializeCas = (cas: Cas): string =>
  `${JSON.stringify(cas, null, 2)}\n`;

export const jwtOf = (item: CasItem): string =>
  typeof item === "string" ? item : item.attestation;

export const decodePayload = (
  jwt: string | undefined,
): Record<string, unknown> | undefined => {
  if (jwt === undefined || jwt === "") {
    return undefined;
  }
  try {
    return decodeJwtPayload(jwt);
  } catch {
    return undefined;
  }
};

const issuerOf = (item: CasItem): unknown => decodePayload(jwtOf(item))?.issuer;

export const ownIndex = (cas: Cas, issuer: string): number =>
  cas.findIndex((item) => issuerOf(item) === issuer);

export const ownEntry = (cas: Cas, issuer: string): CaEntry | undefined => {
  const index = ownIndex(cas, issuer);
  const item = index < 0 ? undefined : cas[index];
  if (item === undefined) {
    return undefined;
  }
  const payload = decodePayload(jwtOf(item));
  if (payload === undefined) {
    return undefined;
  }
  return { jwt: jwtOf(item), payload };
};

export const upsertOwnItem = (cas: Cas, jwt: string, issuer: string): Cas => {
  const index = ownIndex(cas, issuer);
  if (index < 0) {
    return [...cas, jwt];
  }
  return cas.map((item, itemIndex) => {
    if (itemIndex !== index) {
      return item;
    }
    return typeof item === "string" ? jwt : { ...item, attestation: jwt };
  });
};

export const decodeEntries = (cas: Cas): CaEntry[] =>
  cas.map((item) => ({
    jwt: jwtOf(item),
    payload: decodeJwtPayload(jwtOf(item)),
  }));

const DAY_MS = 24 * 60 * 60 * 1000;

export const expiresAt = (jwt: string): Date | undefined => {
  const exp = decodePayload(jwt)?.exp;
  return typeof exp === "number" ? new Date(exp * 1000) : undefined;
};

export const isExpiring = (
  exp: Date | undefined,
  withinDays: number,
  now: Date = new Date(),
): boolean =>
  exp === undefined || exp.getTime() - now.getTime() <= withinDays * DAY_MS;

export const recordedOf = (payload: Record<string, unknown>): Recorded => {
  const subject = isRecord(payload.credentialSubject)
    ? payload.credentialSubject
    : undefined;
  const selector = Array.isArray(payload.target)
    ? payload.target.find(
        (target) => isRecord(target) && target.type === "TextTargetIntegrity",
      )
    : undefined;
  const id = subject?.id;
  const cssSelector = isRecord(selector) ? selector.cssSelector : undefined;
  return {
    ...(typeof id === "string" ? { id } : {}),
    ...(typeof cssSelector === "string" ? { selector: cssSelector } : {}),
  };
};
