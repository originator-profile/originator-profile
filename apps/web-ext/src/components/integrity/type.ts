import { IntegrityVerifyResult } from "@originator-profile/verify";

export type FetchIntegrityFailed = string;

// FetchIntegrityResultをserializeIfErrorに通した時の表現
export type FetchIntegrityMessageResult =
  | IntegrityVerifyResult
  | FetchIntegrityFailed;
