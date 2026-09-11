import { Target } from "@originator-profile/model";
import { TargetIntegrityAlgorithm } from "@originator-profile/verify";
import { useMemo } from "react";

/** CSS セレクターで指定した要素を返すフック関数 */
function useElements(target: Target[]) {
  const elements = useMemo(
    () =>
      target.flatMap((content) =>
        TargetIntegrityAlgorithm[content.type].elementSelector({
          ...content,
          document: window.parent.document,
        }),
      ),
    [target],
  );
  return { elements };
}

export default useElements;
