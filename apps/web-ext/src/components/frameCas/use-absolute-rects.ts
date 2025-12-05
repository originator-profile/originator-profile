import { useMemo } from "react";
import { AncestorFrameCoordinate } from "./types";

export function useAbsoluteRects(
  ancestor: AncestorFrameCoordinate[],
  frameScroll: { scrollX: number; scrollY: number },
  caTarget: DOMRect[],
): DOMRect[] {
  return useMemo(() => {
    return caTarget.map((targetRect) => {
      let x = targetRect.x - frameScroll.scrollX;
      let y = targetRect.y - frameScroll.scrollY;

      for (const frame of [...ancestor].reverse()) {
        x += frame.rect.x;
        y += frame.rect.y;
        x -= frame.scrollX;
        y -= frame.scrollY;
      }

      return new DOMRect(x, y, targetRect.width, targetRect.height);
    });
  }, [ancestor, frameScroll, caTarget]);
}
