import { createDocumentProvider } from "@originator-profile/sign";
import { JSDOM } from "jsdom";

export const documentProvider = createDocumentProvider({
  parseDocument: (html: string, url?: string) =>
    new JSDOM(html, { url }).window.document,
});
