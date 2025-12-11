import type { VerifiedOps } from "@originator-profile/verify";
import type { WebMediaProfile } from "@originator-profile/model";

export function useProfileAnnotatorWmp(
  ops: VerifiedOps,
  profileAnnotatorOpId: string,
): WebMediaProfile | undefined {
  const profileAnnotatorOp = ops.find(
    (op) => op.media?.doc.credentialSubject.id === profileAnnotatorOpId,
  );
  return profileAnnotatorOp?.media?.doc;
}
