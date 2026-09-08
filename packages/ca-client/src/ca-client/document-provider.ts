import type { RawTarget } from "@originator-profile/model";
import { JSDOM } from "jsdom";
import { CaClientError, CaClientErrorCode } from "../errors";
import type { FetchOperations } from "../fetch-operations";

async function fetchDocument(
  url: string,
  fetchOps: FetchOperations,
): Promise<string> {
  let res: Response;
  try {
    res = await fetchOps.fetch(url);
  } catch (error) {
    throw new CaClientError(
      `Failed to fetch document: ${error instanceof Error ? error.message : String(error)}`,
      { code: CaClientErrorCode.Http, cause: error },
    );
  }

  if (!res.ok) {
    throw new CaClientError(
      `Failed to fetch document: ${res.status} ${res.statusText}`,
      { code: CaClientErrorCode.Http, status: res.status },
    );
  }

  return await res.text();
}

export async function documentProvider(
  { type, content = "" }: RawTarget,
  fetchOps: FetchOperations = { fetch },
): Promise<Document> {
  if (type === "ExternalResourceTargetIntegrity") {
    throw new CaClientError(
      "Invalid Content Attestation: ExternalResourceTargetIntegrity is not supported",
      { code: CaClientErrorCode.Validation },
    );
  }

  if (Array.isArray(content) && content.length > 1) {
    throw new CaClientError(
      "Invalid Content Attestation: multiple contents are not supported",
      { code: CaClientErrorCode.Validation },
    );
  }

  const flatContent = Array.isArray(content) ? (content[0] ?? "") : content;
  let url: string | undefined;
  let html: string;

  if (URL.canParse(flatContent)) {
    url = flatContent;
    html = await fetchDocument(url, fetchOps);
  } else {
    url = undefined;
    html = flatContent;
  }

  const dom = new JSDOM(html, {
    url,
  });

  return dom.window.document;
}
