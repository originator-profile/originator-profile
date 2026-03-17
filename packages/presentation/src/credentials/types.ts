import {
  ContentAttestationSet,
  OpMeta,
  OriginatorProfileSet,
} from "@originator-profile/model";
import { CredentialsFetchFailed } from "./errors";

export type FetchCredentialSetResult<T> = T | CredentialsFetchFailed;
export type FetchCredentialsResult = {
  ops: FetchCredentialSetResult<OriginatorProfileSet>;
  cas: FetchCredentialSetResult<ContentAttestationSet>;
  opMeta?: OpMeta;
};
