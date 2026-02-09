import { FetchIntegrityFailed } from "./error";

export type IntegrityVerifyResult = {
  valid: boolean;
  failedIntegrities: ReadonlyArray<string>;
};

export type FetchIntegrityResult = IntegrityVerifyResult | FetchIntegrityFailed;
