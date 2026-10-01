import { OriginatorProfileSet } from "@originator-profile/model";
import {
  DecodedOps,
  VerifiedCas,
  VerifiedOps,
  VerifiedSp,
} from "@originator-profile/verify";

export type CoreProfileIssuersDebugResult = {
  ops: OriginatorProfileSet;
  decoded: DecodedOps;
};

export type VerificationStepResult<T> = T | Error | null;

export interface CasMonitorVerificationResult {
  registryOpsResult: VerificationStepResult<CoreProfileIssuersDebugResult>;
  fetchHtmlResult: VerificationStepResult<string>;
  spResult: VerificationStepResult<VerifiedSp>;
  opsResult: VerificationStepResult<VerifiedOps>;
  casResult: VerificationStepResult<VerifiedCas>;
}
