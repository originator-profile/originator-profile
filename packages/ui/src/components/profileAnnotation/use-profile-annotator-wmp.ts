import { selectByLocale } from "@originator-profile/core";
import type { WebMediaProfile } from "@originator-profile/model";
import type { VerifiedOps } from "@originator-profile/verify";
import { useMemo } from "react";

export function useProfileAnnotatorWmp(
  ops: VerifiedOps,
  profileAnnotatorOpId: string,
): WebMediaProfile | undefined {
  const profileAnnotatorOp = useMemo(
    () =>
      ops.find((op) =>
        op.media?.some(
          (m) => m.doc.credentialSubject.id === profileAnnotatorOpId,
        ),
      ),
    [ops, profileAnnotatorOpId],
  );
  const selectedWmp = useMemo(() => {
    if (!profileAnnotatorOp?.media) return undefined;
    return selectByLocale(profileAnnotatorOp.media.map((m) => m.doc));
  }, [profileAnnotatorOp]);
  return selectedWmp;
}
