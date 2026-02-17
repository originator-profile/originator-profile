import { IntegrityVerifyResult } from "@originator-profile/verify";

export type FetchIntegrityFailedMessage = string;

// FetchIntegrityResultをserializeIfErrorに通した時の表現
export type FetchIntegrityMessageResult =
  | IntegrityVerifyResult
  | FetchIntegrityFailedMessage;
