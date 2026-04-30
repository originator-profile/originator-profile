import type { UnsignedContentAttestation } from "@originator-profile/model";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import rehypeParse from "rehype-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { Plugin, ResolvedConfig } from "vite";
import { parseExpiresIn, parseKey } from "./resolve-content";
import { signCas } from "./sign-cas";
import {
  signSiteProfile,
  SiteProfileInput,
  type SiteProfileOutput,
} from "./sign-site-profile";
import { OriginatorProfileOptions, SigningContext } from "./types";
export {
  fileToDataUrl,
  isLocalPath,
  parseExpiresIn,
  resolveLocalContent,
} from "./resolve-content";

async function buildSiteProfile(
  root: string,
  wspInput: string | undefined,
  signingCtx: SigningContext,
): Promise<SiteProfileOutput> {
  const inputPath = resolve(root, wspInput ?? "./sp.json");
  const inputDir = dirname(inputPath);
  const input = JSON.parse(readFileSync(inputPath, "utf-8")) as unknown;
  return signSiteProfile(SiteProfileInput.parse(input), signingCtx, inputDir);
}

const UNSIGNED_CAS_TYPE =
  "application/prs.originator-profile.unsigned-cas+json";
const SIGNED_CAS_TYPE = "application/cas+json";

const htmlParser = unified().use(rehypeParse);

interface UnsignedCasMatch {
  startOffset: number;
  endOffset: number;
  jsonContent: string;
}

function findUnsignedCasScripts(html: string): UnsignedCasMatch[] {
  const tree = htmlParser.parse(html);
  const matches: UnsignedCasMatch[] = [];
  visit(tree, "element", (node) => {
    if (node.tagName !== "script") return;
    if (node.properties.type !== UNSIGNED_CAS_TYPE) return;
    const startOffset = node.position?.start.offset;
    const endOffset = node.position?.end.offset;
    if (startOffset === undefined || endOffset === undefined) return;
    const jsonContent = node.children
      .map((c) => (c.type === "text" ? c.value : ""))
      .join("");
    matches.push({ startOffset, endOffset, jsonContent });
  });
  return matches;
}

// "</" を JSON 内で "<\/" にエスケープし、署名済み CAS 文字列が偶然 </script>
// 等を含んでも script 要素を早期終了させない。JSON では "/" のエスケープは合法。
function escapeForScript(json: string): string {
  return json.replace(/<\//g, "<\\/");
}

export function originatorProfile(options: OriginatorProfileOptions): Plugin {
  OriginatorProfileOptions.parse(options);

  let root: string;
  let issuers: SigningContext["issuers"];
  let issuedAt: SigningContext["issuedAt"];
  let expiredAt: SigningContext["expiredAt"];

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
