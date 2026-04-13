import type { Jwk, UnsignedContentAttestation } from "@originator-profile/model";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { IndexHtmlTransformContext, Plugin, ResolvedConfig } from "vite";
import { parseExpiresIn, parseKey } from "./resolve-content";
import { signCas } from "./sign-cas";
import { signSiteProfile } from "./sign-site-profile";

export type { OriginatorProfileOptions } from "./types";
export { OriginatorProfileOptionsSchema } from "./types";

export { signCas } from "./sign-cas";
export { signSiteProfile, SiteProfileInputSchema } from "./sign-site-profile";
export {
  fileToDataUrl,
  isLocalPath,
  parseExpiresIn,
  resolveLocalContent,
} from "./resolve-content";

import {
  OriginatorProfileOptionsSchema,
  type OriginatorProfileOptions,
} from "./types";

const CAS_RE =
  /<script\b[^>]*\btype\s*=\s*["']application\/cas\+json["'][^>]*>([\s\S]*?)<\/script>/g;

export function originatorProfile(
  options: OriginatorProfileOptions,
): Plugin {
  OriginatorProfileOptionsSchema.parse(options);

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
        Object.entries(options.issuers).map(([id, key]) => [
          id,
          parseKey(key as string | Jwk),
        ]),
      );
    },

    async transformIndexHtml(html: string, ctx: IndexHtmlTransformContext) {
      const matches = [...html.matchAll(CAS_RE)];
      if (matches.length === 0) return html;

      const baseDir = dirname(ctx.filename);
      const signingCtx = { issuers, issuedAt, expiredAt };

      const replacements = await Promise.all(
        matches.map(async ([fullMatch, jsonContent]) => {
          const entries = JSON.parse(jsonContent) as Array<
            UnsignedContentAttestation & { main?: boolean }
          >;

          const signed = await signCas(entries, signingCtx, baseDir);

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
      const input = JSON.parse(readFileSync(inputPath, "utf-8")) as unknown;

      const output = await signSiteProfile(
        input as never,
        { issuers, issuedAt, expiredAt },
        inputDir,
      );

      this.emitFile({
        type: "asset",
        fileName: ".well-known/sp.json",
        source: JSON.stringify(output),
      });
    },
  };
}
