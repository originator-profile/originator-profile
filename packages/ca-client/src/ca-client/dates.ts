import { CaClientError, CaClientErrorCode } from "../errors";

export type TimingOptions = {
  issuedAt?: Date | string;
  expiredAt?: Date | string;
};

export function parseDates({
  issuedAt: issuedAtDateOrString = new Date(),
  expiredAt: expiredAtDateOrString,
}: TimingOptions = {}): {
  issuedAt: Date;
  expiredAt: Date;
} {
  const issuedAt = new Date(issuedAtDateOrString);
  const expiredAt = expiredAtDateOrString
    ? new Date(expiredAtDateOrString)
    : (() => {
        const next = new Date(issuedAt);
        next.setUTCFullYear(next.getUTCFullYear() + 1);
        return next;
      })();

  if (Number.isNaN(issuedAt.getTime())) {
    throw new CaClientError("issuedAt must be a valid date", {
      code: CaClientErrorCode.Validation,
    });
  }
  if (Number.isNaN(expiredAt.getTime())) {
    throw new CaClientError("expiredAt must be a valid date", {
      code: CaClientErrorCode.Validation,
    });
  }
  if (expiredAt.getTime() <= issuedAt.getTime()) {
    throw new CaClientError("expiredAt must be after issuedAt", {
      code: CaClientErrorCode.Validation,
    });
  }

  return { issuedAt, expiredAt };
}

export const toUnixTime = (date: Date): number =>
  Math.floor(date.getTime() / 1000);
