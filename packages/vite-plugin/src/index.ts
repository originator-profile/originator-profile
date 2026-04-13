import type { Jwk, UnsignedContentAttestation } from "@originator-profile/model";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import { parseExpiresIn, parseKey } from "./resolve-content";
import { signCas } from "./sign-cas";
import {
  SiteProfileInputSchema,
  type SiteProfileOutput,
  signSiteProfile,
} from "./sign-site-profile";

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

async function buildSiteProfile(
  root: string,
  wspInput: string | undefined,
  signingCtx: { issuers: Record<string, Jwk>; issuedAt: Date; expiredAt: Date },
): Promise<SiteProfileOutput> {
  const inputPath = resolve(root, wspInput ?? "./sp.json");
  const inputDir = dirname(inputPath);
  const input = JSON.parse(readFileSync(inputPath, "utf-8")) as unknown;
  return signSiteProfile(SiteProfileInputSchema.parse(input), signingCtx, inputDir);
}

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
          parseKey(key, id),
        ]),
      );
    },

    configureServer(server) {
      server.middlewares.use("/.well-known/sp.json", async (_req, res, next) => {
        try {
          const output = await buildSiteProfile(
            root, options.wsp?.input, { issuers, issuedAt, expiredAt },
          );
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(output));
        } catch (err) {
          next(err);
        }
      });
    },

    async transformIndexHtml(html: string) {
      const matches = [...html.matchAll(CAS_RE)];
      if (matches.length === 0) return html;
      const signingCtx = { issuers, issuedAt, expiredAt };

      const replacements = await Promise.all(
        matches.map(async ([fullMatch, jsonContent]) => {
          const entries = JSON.parse(jsonContent) as Array<
            UnsignedContentAttestation & { main?: boolean }
          >;

          const signed = await signCas(entries, signingCtx, root, html);

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
      const output = await buildSiteProfile(
        root, options.wsp?.input, { issuers, issuedAt, expiredAt },
      );

      this.emitFile({
        type: "asset",
        fileName: ".well-known/sp.json",
        source: JSON.stringify(output),
      });
    },
  };
}
