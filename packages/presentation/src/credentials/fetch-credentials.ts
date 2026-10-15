import {
  ContentAttestationSet,
  OriginatorProfileSet,
} from "@originator-profile/model";
import { getEmbeddedData, scriptSelector } from "../get-embedded-data";
import { CredentialsFetchFailed } from "./errors";
import {
  CAS_ACCEPTED_MEDIA_TYPES,
  OPS_ACCEPTED_MEDIA_TYPES,
} from "./media-types";
import {
  externalSource,
  FetchCredentialSetResult,
  FetchCredentialsResult,
  SourcedCredential,
} from "./types";

function getEndpoints(doc: Document, mediaTypes: readonly string[]): string[] {
  const endpoints = [
    ...doc.querySelectorAll(scriptSelector(mediaTypes, "[src]")),
  ].map((e) => new URL(e.getAttribute("src") ?? "", doc.location.href).href);

  return endpoints;
}

/**
 * {mediaTypes} のいずれかのデータの取得
 * @param doc Document オブジェクト
 * @param mediaTypes 受理するメディアタイプ
 */
async function fetchCredentialSet<
  T extends OriginatorProfileSet | ContentAttestationSet,
>(
  doc: Document,
  mediaTypes: readonly string[],
): Promise<FetchCredentialSetResult<T>> {
  let profiles = getEmbeddedData<T>(doc, mediaTypes);
  try {
    const profileEndpoints = getEndpoints(doc, mediaTypes);

    const profileSetFromEndpoints = await Promise.all(
      profileEndpoints.map(
        async (endpoint): Promise<SourcedCredential<T[number]>[]> => {
          const res = await fetch(endpoint);

          if (!res.ok) {
            throw new CredentialsFetchFailed(`HTTP status code ${res.status}`);
          }

          const json = await res.json();
          const items = (Array.isArray(json) ? json : [json]) as T[number][];
          return items.map((credential) => ({
            credential,
            source: externalSource(endpoint),
          }));
        },
      ),
    );
    profiles = profiles.concat(profileSetFromEndpoints.flat());
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
  fetchCredentialSet<ContentAttestationSet>(doc, CAS_ACCEPTED_MEDIA_TYPES);
export const fetchOriginatorProfileSet = (doc: Document) =>
  fetchCredentialSet<OriginatorProfileSet>(doc, OPS_ACCEPTED_MEDIA_TYPES);

export const fetchCredentials = async (
  doc: Document,
): Promise<FetchCredentialsResult> => {
  const [ops, cas] = await Promise.all([
    fetchOriginatorProfileSet(doc),
    fetchContentAttestationSet(doc),
  ]);
  return {
    ops,
    cas,
  };
};
