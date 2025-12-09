import { useMemo } from "react";
import { FrameCoordinate, CaCoordinate } from "./types";

export function useFrameCaRects(
  frameCoordinate: FrameCoordinate,
  caCoordinate: CaCoordinate,
): DOMRect[] {
  return useMemo(() => {
    if (!frameCoordinate.ancestor.every((a) => a.visible)) return [];
    return caCoordinate.target.map((targetRect) => {
      let x = targetRect.x;
      let y = targetRect.y;

      for (const frame of frameCoordinate.ancestor.toReversed()) {
        x += frame.rect.x;
        y += frame.rect.y;
      }

      return new DOMRect(x, y, targetRect.width, targetRect.height);
    });
  }, [frameCoordinate, caCoordinate]);
}
