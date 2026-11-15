import type { UnsignedContentAttestation } from "@originator-profile/model";
import { JSDOM } from "jsdom";
import { createHash } from "node:crypto";
import { onTestFinished } from "vitest";

export const SELECTOR = "[itemprop='headline'], [itemprop='articleBody']";
export const ISSUER = "dns:example.com";

export const jwt = (payload: Record<string, unknown>) => {
  const b64u = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${b64u({ alg: "none" })}.${b64u(payload)}.sig`;
};

export const textIntegrity = (html: string, selector: string) => {
  const dom = new JSDOM(html);
  const text = Array.from(
    dom.window.document.querySelectorAll(selector),
    (element) => element.textContent ?? "",
  ).join("");
  dom.window.close();
  return `sha256-${createHash("sha256").update(text, "utf-8").digest("base64")}`;
};

const DAY_S = 24 * 60 * 60;
export const expIn = (days: number) =>
  Math.floor(Date.now() / 1000) + days * DAY_S;
export const payloadOf = (token: string) =>
  JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

export const honestSigner = (signed: UnsignedContentAttestation[] = []) => ({
  sign: async (uca: UnsignedContentAttestation) => {
    signed.push(uca);
    return jwt({
      issuer: uca.issuer,
      exp: expIn(365),
      credentialSubject: { id: "urn:uuid:new", ...uca.credentialSubject },
      allowedUrl: uca.allowedUrl,
      target: uca.target.map((target) =>
        target.type === "TextTargetIntegrity"
          ? {
              type: target.type,
              cssSelector: target.cssSelector,
              integrity: textIntegrity(
                String(target.content),
                String(target.cssSelector),
              ),
            }
          : target,
      ),
    });
  },
  reSign: async (payload: Record<string, unknown>) =>
    jwt({ ...payload, renewed: true, exp: expIn(365) }),
});

export const inRoot = (root: string) => {
  const cwd = process.cwd();
  process.chdir(root);
  onTestFinished(() => process.chdir(cwd));
};
