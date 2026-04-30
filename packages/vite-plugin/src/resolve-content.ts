import { Jwk as JwkSchema, type Jwk } from "@originator-profile/model";
import { addMilliseconds } from "date-fns";
import mime from "mime";
import ms from "ms";
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
  let millis: number | undefined;
  try {
    millis = ms(expiresIn as Parameters<typeof ms>[0]) as number | undefined;
  } catch {
    millis = undefined;
  }
  if (typeof millis !== "number") {
    throw new Error(
      `Invalid expiresIn: "${expiresIn}". See https://github.com/vercel/ms for accepted formats (e.g., "1y", "30d", "12h").`,
    );
  }
  return addMilliseconds(from, millis);
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
