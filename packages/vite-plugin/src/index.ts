import type {
  Jwk,
  RawImage,
  UnsignedContentAttestation,
  UnsignedWebsiteProfile,
} from "@originator-profile/model";
import {
  ContentAttestation,
  WebsiteProfile,
} from "@originator-profile/opvc";
import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import type { IndexHtmlTransformContext, Plugin, ResolvedConfig } from "vite";

export interface OriginatorProfileOptions {
  /** Mapping of OP ID to signing key (JWK object or JSON string). */
  issuers: Record<string, string | Jwk>;
  /** Duration until signed credentials expire. Defaults to "1y". */
  expiresIn?: string;
  wsp?: {
    /** Path to unsigned Site Profile, relative to project root. Defaults to "./sp.json". */
    input?: string;
  };
}

interface SiteProfileInput {
  originators: unknown[];
  sites: UnsignedWebsiteProfile[];
}

const CAS_RE =
  /<script\b[^>]*\btype\s*=\s*["']application\/cas\+json["'][^>]*>([\s\S]*?)<\/script>/g;

function parseExpiresIn(expiresIn: string, from: Date): Date {
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

function parseKey(value: string | Jwk): Jwk {
  return typeof value === "string" ? (JSON.parse(value) as Jwk) : value;
}

function resolveKey(issuers: Record<string, Jwk>, issuer: string): Jwk {
  const key = issuers[issuer];
  if (!key) {
    throw new Error(
      `No signing key found for issuer "${issuer}". ` +
        `Registered issuers: ${Object.keys(issuers).join(", ")}`,
    );
  }
  return key;
}

const IMAGE_MIME: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function isLocalPath(value: string): boolean {
  return !value.startsWith("data:") && !/^https?:\/\//.test(value);
}

function fileToDataUrl(filePath: string): string {
  const bytes = readFileSync(filePath);
  const mime = IMAGE_MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function resolveImageContent(
  image: RawImage | undefined,
  baseDir: string,
): void {
  if (!image?.content) return;

  if (typeof image.content === "string") {
    if (isLocalPath(image.content)) {
      image.content = fileToDataUrl(resolve(baseDir, image.content));
    }
  } else {
    image.content = image.content.map((c) =>
      isLocalPath(c) ? fileToDataUrl(resolve(baseDir, c)) : c,
    );
  }
}

export function originatorProfile(
  options: OriginatorProfileOptions,
): Plugin {
  let root: string;
  let issuers: Record<string, Jwk>;
  let issuedAt: Date;
  let expiredAt: Date;

  return {
    name: "originator-profile",

    configResolved(config: ResolvedConfig) {
      root = config.root;
      issuedAt = new Date();
      expiredAt = parseExpiresIn(options.expiresIn ?? "1y", issuedAt);

      issuers = Object.fromEntries(
        Object.entries(options.issuers).map(([id, key]) => [id, parseKey(key)]),
      );
    },

    async transformIndexHtml(html: string, ctx: IndexHtmlTransformContext) {
      const matches = [...html.matchAll(CAS_RE)];
      if (matches.length === 0) return html;

      const baseDir = dirname(ctx.filename);

      const replacements = await Promise.all(
        matches.map(async ([fullMatch, jsonContent]) => {
          const entries = JSON.parse(jsonContent) as Array<
            UnsignedContentAttestation & { main?: boolean }
          >;

          const signed = await Promise.all(
            entries.map(async (entry) => {
              const { main, ...uca } = entry;
              resolveImageContent(
                uca.credentialSubject.image as RawImage | undefined,
                baseDir,
              );
              const key = resolveKey(issuers, uca.issuer);

              const jwt = await ContentAttestation.sign(
                uca as UnsignedContentAttestation,
                key,
                { issuedAt, expiredAt },
              );

              return main ? { attestation: jwt, main: true } : jwt;
            }),
          );

          return {
            from: fullMatch,
            to: `<script type="application/cas+json">${JSON.stringify(signed)}</script>`,
          };
        }),
      );

      let result = html;
      for (const { from, to } of replacements) {
        result = result.replace(from, to);
      }
      return result;
    },

    async generateBundle() {
      const inputPath = resolve(root, options.wsp?.input ?? "./sp.json");
      const inputDir = dirname(inputPath);
      const input = JSON.parse(
        readFileSync(inputPath, "utf-8"),
      ) as SiteProfileInput;

      const signedSites = await Promise.all(
        input.sites.map(async (uwsp) => {
          resolveImageContent(
            uwsp.credentialSubject.image as RawImage | undefined,
            inputDir,
          );
          const key = resolveKey(issuers, uwsp.issuer);

          return await WebsiteProfile.sign(uwsp, key, {
            issuedAt,
            expiredAt,
          });
        }),
      );

      this.emitFile({
        type: "asset",
        fileName: ".well-known/sp.json",
        source: JSON.stringify({
          originators: input.originators,
          sites: signedSites,
        }),
      });
    },
  };
}
