import {
  ContentAttestationSet,
  OpMeta,
  OriginatorProfileSet,
} from "@originator-profile/model";
import { CredentialsFetchFailed } from "./errors";
import { FetchCredentialSetResult, FetchCredentialsResult } from "./types";

function getEndpoints(doc: Document, mediaType: string): string[] {
  const endpoints = [
    ...doc.querySelectorAll(`script[src][type="${mediaType}"]`),
  ].map((e) => new URL(e.getAttribute("src") ?? "", doc.location.href).href);

  return endpoints;
}

/**
 * 文書内の {mediaType} のデータの取得
 * @param doc Document オブジェクト
 * @param mediaType メディアタイプ
 */
function getEmbeddedCredentials<
  T extends OriginatorProfileSet | ContentAttestationSet | OpMeta[],
>(doc: Document = document, mediaType: string): T {
  const elements = [...doc.querySelectorAll(`script[type="${mediaType}"]`)];
  const credentialsArray = elements
    .map((elem) => {
      const text = elem.textContent;
      if (typeof text !== "string") {
        return undefined;
      }
      try {
        const json = JSON.parse(text);
        return json;
      } catch (e: unknown) {
        return undefined;
      }
    })
    .filter((e) => typeof e !== "undefined");

  return credentialsArray.flat() as T;
}

/**
 * {mediaType} のデータの取得
 * @param doc Document オブジェクト
 */
async function fetchCredentialSet<
  T extends OriginatorProfileSet | ContentAttestationSet,
>(doc: Document, mediaType: string): Promise<FetchCredentialSetResult<T>> {
  let profiles = getEmbeddedCredentials<T>(doc, mediaType);
  try {
    const profileEndpoints = getEndpoints(doc, mediaType);

    const profileSetFromEndpoints = await Promise.all(
      profileEndpoints.map(async (endpoint) => {
        const res = await fetch(endpoint);

        if (!res.ok) {
          throw new CredentialsFetchFailed(`HTTP status code ${res.status}`);
        }

        return await res.json();
      }),
    );
    profiles = profiles.concat(profileSetFromEndpoints.flat()) as T;
  } catch (e) {
    if (e instanceof Error || e instanceof window.Error) {
      return new CredentialsFetchFailed(
        `Credentials fetch failed:\n${e.message}`,
        {
          cause: e,
        },
      );
    } else {
      throw new Error("Unknown error", { cause: e });
    }
  }

  return profiles;
}

export const fetchContentAttestationSet = (doc: Document) =>
  fetchCredentialSet<ContentAttestationSet>(doc, "application/cas+json");
export const fetchOriginatorProfileSet = (doc: Document) =>
  fetchCredentialSet<OriginatorProfileSet>(doc, "application/ops+json");

function isValidOpMeta(value: unknown): value is OpMeta {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const opMeta = value as { targetopid?: unknown };
  return typeof opMeta.targetopid === "string" && opMeta.targetopid.length > 0;
}

export const fetchOpMeta = (doc: Document): OpMeta | undefined => {
  const opMetas = getEmbeddedCredentials<OpMeta[]>(
    doc,
    "application/opmeta+json",
  );

  if (opMetas.length > 1) {
    console.warn(
      "Multiple OpMeta elements found. Only the first one will be used.",
    );
  }

  const firstOpMeta = opMetas[0];
  if (!isValidOpMeta(firstOpMeta)) {
    return undefined;
  }
  return firstOpMeta;
};

export const fetchCredentials = async (
  doc: Document,
): Promise<FetchCredentialsResult> => {
  const [ops, cas, opMeta] = await Promise.all([
    fetchOriginatorProfileSet(doc),
    fetchContentAttestationSet(doc),
    fetchOpMeta(doc),
  ]);
  return {
    ops,
    cas,
    opMeta,
  };
};
