import { Jwk as JwkSchema, type Jwk } from "@originator-profile/model";
import { addDays, addMonths, addYears } from "date-fns";
import mime from "mime";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function isLocalPath(value: string): boolean {
  return !value.startsWith("data:") && !/^https?:\/\//.test(value);
}

export function fileToDataUrl(filePath: string): string {
  const bytes = readFileSync(filePath);
  const mimeType = mime.getType(filePath) ?? "application/octet-stream";
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

export function resolveLocalContent(
  obj: { content?: string | string[] } | undefined,
  baseDir: string,
): void {
  if (!obj?.content) return;

  if (typeof obj.content === "string") {
    if (isLocalPath(obj.content)) {
      obj.content = fileToDataUrl(resolve(baseDir, obj.content));
    }
  } else {
    obj.content = obj.content.map((c) =>
      isLocalPath(c) ? fileToDataUrl(resolve(baseDir, c)) : c,
    );
  }
}

export function parseExpiresIn(expiresIn: string, from: Date): Date {
  const match = expiresIn.match(/^(\d+)([ymd])$/);
  if (!match) {
    throw new Error(
      `Invalid expiresIn format: "${expiresIn}". Use "1y", "6m", or "30d".`,
    );
  }
  const amount = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case "y":
      return addYears(from, amount);
    case "m":
      return addMonths(from, amount);
    case "d":
      return addDays(from, amount);
    default:
      throw new Error(`Unexpected unit: ${unit}`);
  }
}

export function parseKey(value: string | Jwk, issuer?: string): Jwk {
  if (typeof value !== "string") return value;
  const context = issuer ? ` for issuer "${issuer}"` : "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`Invalid signing key${context}: expected valid JSON`);
  }
  const result = JwkSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid signing key${context}: ${result.error.issues[0].message}`,
    );
  }
  return result.data;
}

export function resolveKey(issuers: Record<string, Jwk>, issuer: string): Jwk {
  const key = issuers[issuer];
  if (!key) {
    throw new Error(
      `No signing key found for issuer "${issuer}". ` +
        `Registered issuers: ${Object.keys(issuers).join(", ")}`,
    );
  }
  return key;
}
