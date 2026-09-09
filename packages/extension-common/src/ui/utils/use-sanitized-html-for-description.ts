import { WebMediaProfile } from "@originator-profile/model";
import DOMPurify, { Config as DOMPurifyConfig } from "dompurify";

type DescriptionObject = {
  text: string;
  encodingFormat: "text/plain" | "text/html";
};

// "text/plain" のescape 対応
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const HTML_DESCRIPTION_CONFIG: DOMPurifyConfig = {
  // 許可するタグをホワイトリストで限定
  ALLOWED_TAGS: ["br", "p", "ol", "ul", "li"],
  // 属性は一切許可しない
  ALLOWED_ATTR: [],
  // data-* も許可しない
  ALLOW_DATA_ATTR: false,
};

/** HTML文字列をサニタイズするカスタムフック for Description */
export default function useSanitizedHtmlForDescription(
  description: WebMediaProfile["credentialSubject"]["description"],
): string | undefined {
  const dangerousHtml = Array.isArray(description)
    ? (description.find(
        (d) => typeof d === "object" && d.encodingFormat === "text/html",
      ) ?? description[0])
    : description;

  if (dangerousHtml === undefined) return;

  let desc: DescriptionObject;

  if (typeof dangerousHtml === "string") {
    desc = { text: dangerousHtml, encodingFormat: "text/plain" };
  } else {
    desc = dangerousHtml;
  }

  if (desc.encodingFormat === "text/html") {
    const parser = new DOMParser();
    const descriptionDocument = parser.parseFromString(desc.text, "text/html");
    const res = DOMPurify.sanitize(
      descriptionDocument.body.innerHTML,
      HTML_DESCRIPTION_CONFIG,
    );
    return res;
  }
  // "text/plain"
  return escapeHtml(desc.text).replace(/\r?\n/g, "<br>");
}
