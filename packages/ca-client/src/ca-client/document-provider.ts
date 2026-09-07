import type { RawTarget } from "@originator-profile/model";
import { createDocumentProvider, FetchFailed } from "@originator-profile/sign";
import { JSDOM } from "jsdom";
import { CaClientError, CaClientErrorCode } from "../errors";
import type { FetchOperations } from "../fetch-operations";

function parseDocument(html: string, url?: string): Document {
  return new JSDOM(html, { url }).window.document;
}

function fetchDocument(
  fetchOps: FetchOperations,
): (url: string) => Promise<Response> {
  return async (url) => {
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

    return res;
  };
}

function toCaClientError(error: unknown): CaClientError {
  if (error instanceof CaClientError) {
    return error;
  }

  if (error instanceof FetchFailed) {
    if (error.error instanceof CaClientError) {
      return error.error;
    }

    return new CaClientError(
      `Failed to fetch document: ${error.error.message}`,
      { code: CaClientErrorCode.Http, cause: error.error },
    );
  }

  return new CaClientError(
    `Invalid Content Attestation: ${error instanceof Error ? error.message : String(error)}`,
    { code: CaClientErrorCode.Validation, cause: error },
  );
}

export async function documentProvider(
  raw: RawTarget,
  fetchOps: FetchOperations = { fetch },
): Promise<Document> {
  const provide = createDocumentProvider({
    fetch: fetchDocument(fetchOps),
    parseDocument,
  });

  try {
    return await provide(raw);
  } catch (error) {
    throw toCaClientError(error);
  }
}
