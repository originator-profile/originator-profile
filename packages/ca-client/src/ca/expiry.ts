const DAY_MS = 24 * 60 * 60 * 1000;

export const jwtPayload = (
  jwt: string | undefined,
): Record<string, unknown> | undefined => {
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(jwt?.split(".")[1] ?? "", "base64url").toString("utf-8"),
    );
    return typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

export const expiresAt = (jwt: string): Date | undefined => {
  const exp = jwtPayload(jwt)?.exp;
  return typeof exp === "number" ? new Date(exp * 1000) : undefined;
};

export const isExpiring = (
  exp: Date | undefined,
  withinDays: number,
  now: Date = new Date(),
): boolean =>
  exp === undefined || exp.getTime() - now.getTime() <= withinDays * DAY_MS;
