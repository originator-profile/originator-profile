import { JSDOM } from "jsdom";

/** URL としてパースできないケースや URL path が "" や "/" のケースでの変換処理 */
export function transformEndpoint(endpoint: string): string {
  // NOTE: URL パースできないケース … 特別に "https://" + endpoint と解釈 (#1240)
  if (!URL.canParse(endpoint)) {
    endpoint = `https://${endpoint}`;
  }

  // NOTE: URL path が "" や "/" のケース … 特別に "/.well-known/sp.json" と解釈 (#1240)
  if (new URL(endpoint).origin === endpoint.replace(/[/]$/, "")) {
    endpoint = new URL("/.well-known/sp.json", endpoint).href;
  }

  return endpoint;
}

export async function prepareHtml(url: string) {
  if (!URL.canParse(url)) return new Error("URL Invalid");
  const contentUrl = transformEndpoint(url);
  try {
    const res = await fetch(contentUrl);
    return await res.text();
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e));
  }
}

/**
 * 検証用 HTML から Document を構築する。
 */
export function buildVerificationDocument(html: string, url: string): Document {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  for (const el of doc.querySelectorAll("[src]")) {
    const src = el.getAttribute("src");
    if (!src) continue;
    try {
      el.setAttribute("src", new URL(src, url).toString());
    } catch {
      // src が URL として不正な場合は書き換えをスキップし、検証全体を止めない
    }
  }
  return doc;
}
