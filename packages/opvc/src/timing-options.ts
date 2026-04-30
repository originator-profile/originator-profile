import { parseExpirationDate } from "@originator-profile/core";
import { addYears } from "date-fns";
import { BadRequestError } from "http-errors-enhanced";

export type TimingOptions = {
  issuedAt?: Date | string;
  expiredAt?: Date | string;
};

function assertValidDate(
  value: Date,
  fieldName: "issuedAt" | "expiredAt",
): void {
  if (Number.isNaN(value.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid date.`);
  }
}

export function parseDates({
  issuedAt: issuedAtDateOrString = new Date(),
  expiredAt: expiredAtDateOrString = addYears(new Date(), 1),
}: TimingOptions): {
  issuedAt: Date;
  expiredAt: Date;
} {
  const issuedAt: Date = new Date(issuedAtDateOrString);

  const expiredAt: Date =
    typeof expiredAtDateOrString === "string"
      ? parseExpirationDate(expiredAtDateOrString)
      : new Date(expiredAtDateOrString);

  assertValidDate(issuedAt, "issuedAt");
  assertValidDate(expiredAt, "expiredAt");

  return { issuedAt, expiredAt };
}
