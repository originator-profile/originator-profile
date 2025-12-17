import { useMemo } from "react";
import { CaCoordinate, FrameCoordinate } from "./types";

export function useFrameCaRects(
  frameCoordinate: FrameCoordinate,
  caCoordinate: CaCoordinate,
): DOMRect[] {
  return useMemo(() => {
    if (!frameCoordinate.ancestor.every((a) => a.visible)) return [];
    return caCoordinate.target.map((targetRect) => {
      const initialX = targetRect.x;
      const initialY = targetRect.y;

      const { x, y } = frameCoordinate.ancestor.reduceRight(
        (acc, frame) => ({
          x: acc.x + frame.rect.x,
          y: acc.y + frame.rect.y,
        }),
        { x: initialX, y: initialY },
      );

      return new DOMRect(x, y, targetRect.width, targetRect.height);
    });
  }, [frameCoordinate, caCoordinate]);
}
