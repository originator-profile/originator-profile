import DOMPurify, { Config as DOMPurifyConfig } from "dompurify";

type DescriptionObject = {
  text: string;
  encodingFormat: "text/plain" | "text/html";
}

function isDescriptionObject(value:unknown): value is DescriptionObject {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).text === "string" &&
    typeof (value as any).encodingFormat === "string"
  );
}

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
  ALLOWED_TAGS:[
    "br", "p", "ol", "ul", "li",
    // MEMO :
    // "a" は 元実装に afterSanitizeAttributes 使って処理してるため一旦許可する
    // 許可しない場合、FORBID_TAGS に移動します
    "a"
  ],
  // 属性は一切許可しない
  ALLOWED_ATTR:[],
  // data-* も許可しない
  ALLOW_DATA_ATTR: false,
  // 外部リソース系タグを明示的に禁止
  FORBID_TAGS:[
    //"a",
    "img",
    "script",
    "link",
    "iframe",
    "object",
    "embed",
    "video",
    "audio",
    "source",
    "svg",
    "math",
  ],
  // 削除した要素の中身テキストは保持(default:true)
  // KEEP_CONTENT: true
}

function sanitizedHtml(raw : string): string {
    const parser = new DOMParser();
    const descriptionDocument = parser.parseFromString(
      raw,
      "text/html",
    );
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName !== "A") return;
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    });
    const res = DOMPurify.sanitize(descriptionDocument.body.innerHTML, HTML_DESCRIPTION_CONFIG);
    // addHook はグローバル登録されるため、remove しないと複数回登録されてしまう
    DOMPurify.removeAllHooks();
    return res;
}

/** HTML文字列をサニタイズするカスタムフック */
export default function useSanitizedHtml(
  dangerousHtml?: string | object,
): string | undefined {
  let desc : DescriptionObject | null = null;

  if(typeof dangerousHtml === "string") {
    desc = {text: dangerousHtml, encodingFormat:"text/plain"};
  } else if(isDescriptionObject(dangerousHtml)) {
    desc = dangerousHtml;
  }

  if(!desc) return;

  if(desc.encodingFormat === "text/html") {
    return sanitizedHtml(desc.text);
  }

  // "text/plain"
  return escapeHtml(desc.text).replace(/\r?\n/g, "<br>");
}
