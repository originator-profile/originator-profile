import type { WebMediaProfile } from "@originator-profile/model";
import type { VerifiedOps } from "@originator-profile/verify";
import { useMemo } from "react";

export function useProfileAnnotatorWmp(
  ops: VerifiedOps,
  profileAnnotatorOpId: string,
): WebMediaProfile | undefined {
  const profileAnnotatorOp = useMemo(
    () =>
      ops.find(
        (op) => op.media?.doc.credentialSubject.id === profileAnnotatorOpId,
      ),
    [ops, profileAnnotatorOpId],
  );
  return profileAnnotatorOp?.media?.doc;
}
