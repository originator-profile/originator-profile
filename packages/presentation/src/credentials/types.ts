import {
  ContentAttestationSet,
  OriginatorProfileSet,
} from "@originator-profile/model";
import { CredentialsFetchFailed } from "./errors";

export type CredentialSource =
  | { kind: "embedded"; elementIndex: number }
  | { kind: "external"; url: string };

export const embeddedSource = (elementIndex: number): CredentialSource => ({
  kind: "embedded",
  elementIndex,
});
export const externalSource = (url: string): CredentialSource => ({
  kind: "external",
  url,
});

export type SourcedCredential<T> = {
  source: CredentialSource;
  credential: T;
};

export type FetchCredentialSetResult<T extends unknown[]> =
  | SourcedCredential<T[number]>[]
  | CredentialsFetchFailed;
export type FetchCredentialsResult = {
  ops: FetchCredentialSetResult<OriginatorProfileSet>;
  cas: FetchCredentialSetResult<ContentAttestationSet>;
};
