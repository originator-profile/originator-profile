import type { Jwk } from "@originator-profile/model";
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const MEDIA_MIME: Record<string, string> = {
  // image
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  // video
  ".mp4": "video/mp4",
  ".ogg": "video/ogg",
  ".webm": "video/webm",
  // audio
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

export function isLocalPath(value: string): boolean {
  return !value.startsWith("data:") && !/^https?:\/\//.test(value);
}

export function fileToDataUrl(filePath: string): string {
  const bytes = readFileSync(filePath);
  const mime =
    MEDIA_MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  return `data:${mime};base64,${bytes.toString("base64")}`;
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
  const result = new Date(from);
  switch (unit) {
    case "y":
      result.setFullYear(result.getFullYear() + amount);
      break;
    case "m":
      result.setMonth(result.getMonth() + amount);
      break;
    case "d":
      result.setDate(result.getDate() + amount);
      break;
  }
  return result;
}

export function parseKey(value: string | Jwk): Jwk {
  return typeof value === "string" ? (JSON.parse(value) as Jwk) : value;
}

export function resolveKey(
  issuers: Record<string, Jwk>,
  issuer: string,
): Jwk {
  const key = issuers[issuer];
  if (!key) {
    throw new Error(
      `No signing key found for issuer "${issuer}". ` +
        `Registered issuers: ${Object.keys(issuers).join(", ")}`,
    );
  }
  return key;
}
