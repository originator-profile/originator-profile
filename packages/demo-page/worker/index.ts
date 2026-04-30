// Cloudflare Worker script
// ブラウザの言語やアクセスしたページの言語によって、日本語/英語のページへリダイレクトする
import { parse } from "accept-language-parser";

const LANGS = ["en", "ja"] as const;
type Lang = (typeof LANGS)[number];

function detectLangFromRequest(request: Request): Lang | null {
  const referer = request.headers.get("Referer") ?? "";
  const path = new URL(request.url).pathname;
  const sources = [path, referer];

  for (const src of sources) {
    if (!src) continue;
    if (src.includes("/en")) return "en";
    if (src.includes("/ja")) return "ja";
  }

  return null;
}

function parseAcceptLanguage(header = ""): Lang {
  const parsed = parse(header);

  for (const { code } of parsed) {
    if (LANGS.includes(code as Lang)) {
      return code as Lang;
    }
  }

  return "en";
}

interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const contextLang = detectLangFromRequest(request);
    const headerLang = parseAcceptLanguage(
      request.headers.get("Accept-Language") ?? "",
    );
    const lang = contextLang ?? headerLang;

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return Response.redirect(`${url.origin}/${lang}/`, 302);
    }

    const response = await env.ASSETS.fetch(request);
    if (response.headers.get("Content-Type")?.startsWith("image/")) {
      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    return response;
  },
};
