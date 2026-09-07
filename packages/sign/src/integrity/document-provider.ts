import type { RawTarget } from "@originator-profile/model";
import { FetchFailed, UnsupportedDocumentTarget } from "./error";
import type { DocumentProvider } from "./types";

export type CreateDocumentProviderOptions = {
  fetch?: (url: string) => Promise<Response>;
  parseDocument: (html: string, url?: string) => Document;
};

function isError(value: unknown): value is Error {
  return (
    value instanceof Error ||
    (typeof window !== "undefined" && value instanceof window.Error)
  );
}

async function fetchHtml(
  url: string,
  fetcher: (url: string) => Promise<Response>,
): Promise<string> {
  let res: Response;
  try {
    res = await fetcher(url);
  } catch (e) {
    if (e instanceof FetchFailed) {
      throw e;
    }
    if (isError(e)) {
      throw new FetchFailed(`Failed to fetch`, e);
    }
    throw e;
  }

  return await res.text();
}

/** HTTP ステータスは見ない。非 2xx を失敗にするなら `fetch` 側で throw する。 */
export function createDocumentProvider({
  fetch: fetcher = fetch,
  parseDocument,
}: CreateDocumentProviderOptions): DocumentProvider {
  return async ({ type, content = "" }: RawTarget): Promise<Document> => {
    if (type === "ExternalResourceTargetIntegrity") {
      throw new UnsupportedDocumentTarget(
        "ExternalResourceTargetIntegrity is not supported in this context.",
      );
    }

    if (Array.isArray(content) && content.length > 1) {
      throw new UnsupportedDocumentTarget(
        "Multiple contents are not supported in this context.",
      );
    }

    const flatContent = Array.isArray(content) ? (content[0] ?? "") : content;
    let url: string | undefined;
    let html: string;

    if (URL.canParse(flatContent)) {
      url = flatContent;
      html = await fetchHtml(url, fetcher);
    } else {
      url = undefined;
      html = flatContent;
    }

    return parseDocument(html, url);
  };
}
