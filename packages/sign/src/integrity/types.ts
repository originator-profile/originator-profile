import type { RawTarget } from "@originator-profile/model";

export type DigestSriSource = { id: string; content?: string | string[] };
export type DigestSriResult = { id: string; digestSRI: string };
export type DigestSriContent = DigestSriSource | DigestSriResult;

export type ContentFetcher = (
  elements: ReadonlyArray<HTMLElement>,
  fetcher?: typeof fetch,
) => Promise<ReadonlyArray<Response>>;

export type ElementSelector = (params: {
  cssSelector?: string;
  integrity?: string;
  document: Document;
}) => ReadonlyArray<HTMLElement>;

/** 文脈に応じて Document を提供する関数 */
export type DocumentProvider = (raw: RawTarget) => Promise<Document>;
