import DOMPurify from "dompurify";

/** HTML文字列をサニタイズするカスタムフック */
export default function useSanitizedHtml(
  dangerousHtml?: string,
): string | undefined {
  if (dangerousHtml === undefined) return;

  const parser = new DOMParser();
  const descriptionDocument = parser.parseFromString(
    dangerousHtml,
    "text/html",
  );

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName !== "A") return;
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  });

  const res = DOMPurify.sanitize(descriptionDocument.body.innerHTML);

  // addHook はグローバル登録されるため、remove しないと複数回登録されてしまう
  DOMPurify.removeAllHooks();

  return res;
}
