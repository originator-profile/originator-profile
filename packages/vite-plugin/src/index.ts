import type {
  Jwk,
  UnsignedContentAttestation,
} from "@originator-profile/model";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import type { Plugin, ResolvedConfig } from "vite";
import { parseExpiresIn, parseKey } from "./resolve-content";
import { signCas } from "./sign-cas";
import {
  signSiteProfile,
  SiteProfileInputSchema,
  type SiteProfileOutput,
} from "./sign-site-profile";

export { OriginatorProfileOptionsSchema } from "./types";
export type { OriginatorProfileOptions } from "./types";

export {
  fileToDataUrl,
  isLocalPath,
  parseExpiresIn,
  resolveLocalContent,
} from "./resolve-content";
export { signCas } from "./sign-cas";
export { signSiteProfile, SiteProfileInputSchema } from "./sign-site-profile";

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
  return signSiteProfile(
    SiteProfileInputSchema.parse(input),
    signingCtx,
    inputDir,
  );
}

const UNSIGNED_CAS_TYPE =
  "application/prs.originator-profile.unsigned-cas+json";
const SIGNED_CAS_TYPE = "application/cas+json";

type Element = DefaultTreeAdapterMap["element"];
type TextNode = DefaultTreeAdapterMap["textNode"];
type Node = DefaultTreeAdapterMap["node"];

function isElement(node: Node): node is Element {
  return "tagName" in node;
}

function isTextNode(node: Node): node is TextNode {
  return node.nodeName === "#text";
}

function* walkElements(node: Node): Generator<Element> {
  if (isElement(node)) {
    yield node;
  }
  if ("childNodes" in node) {
    for (const child of node.childNodes) {
      yield* walkElements(child);
    }
  }
}

function getAttr(el: Element, name: string): string | undefined {
  return el.attrs.find((a) => a.name === name)?.value;
}

function getTextContent(el: Element): string {
  return el.childNodes.map((c) => (isTextNode(c) ? c.value : "")).join("");
}

interface UnsignedCasMatch {
  startOffset: number;
  endOffset: number;
  jsonContent: string;
}

function findUnsignedCasScripts(html: string): UnsignedCasMatch[] {
  const doc = parse(html, { sourceCodeLocationInfo: true });
  const matches: UnsignedCasMatch[] = [];
  for (const el of walkElements(doc)) {
    if (el.tagName !== "script") continue;
    if (getAttr(el, "type") !== UNSIGNED_CAS_TYPE) continue;
    const loc = el.sourceCodeLocation;
    if (!loc) continue;
    matches.push({
      startOffset: loc.startOffset,
      endOffset: loc.endOffset,
      jsonContent: getTextContent(el),
    });
  }
  return matches;
}

// "</" を JSON 内で "<\/" にエスケープし、署名済み CAS 文字列が偶然 </script>
// 等を含んでも script 要素を早期終了させない。JSON では "/" のエスケープは合法。
function escapeForScript(json: string): string {
  return json.replace(/<\//g, "<\\/");
}

export function originatorProfile(options: OriginatorProfileOptions): Plugin {
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
      server.middlewares.use(
        "/.well-known/sp.json",
        async (_req, res, next) => {
          try {
            const output = await buildSiteProfile(root, options.wsp?.input, {
              issuers,
              issuedAt,
              expiredAt,
            });
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(output));
          } catch (err) {
            next(err);
          }
        },
      );
    },

    async transformIndexHtml(html: string) {
      const matches = findUnsignedCasScripts(html);
      if (matches.length === 0) return html;
      const signingCtx = { issuers, issuedAt, expiredAt };

      const replacements = await Promise.all(
        matches.map(async (m) => {
          const entries = JSON.parse(m.jsonContent) as Array<
            UnsignedContentAttestation & { main?: boolean }
          >;
          const signed = await signCas(entries, signingCtx, root, html);
          return {
            startOffset: m.startOffset,
            endOffset: m.endOffset,
            replacement: `<script type="${SIGNED_CAS_TYPE}">${escapeForScript(JSON.stringify(signed))}</script>`,
          };
        }),
      );

      replacements.sort((a, b) => b.startOffset - a.startOffset);

      let result = html;
      for (const { startOffset, endOffset, replacement } of replacements) {
        result =
          result.slice(0, startOffset) + replacement + result.slice(endOffset);
      }
      return result;
    },

    async generateBundle() {
      const output = await buildSiteProfile(root, options.wsp?.input, {
        issuers,
        issuedAt,
        expiredAt,
      });

      this.emitFile({
        type: "asset",
        fileName: ".well-known/sp.json",
        source: JSON.stringify(output),
      });
    },
  };
}
