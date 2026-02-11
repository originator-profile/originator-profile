import { FetchIntegrityFailed, IntegrityVerificationFailed } from "./error";

export type IntegrityVerifyResult = {
  valid: boolean;
  failedIntegrities: ReadonlyArray<string>;
};

export type FetchIntegrityResult =
  | IntegrityVerifyResult
  | FetchIntegrityFailed
  | IntegrityVerificationFailed;
