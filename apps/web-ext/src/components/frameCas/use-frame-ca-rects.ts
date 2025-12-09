import { useMemo } from "react";
import { FrameCoordinate, CaCoordinate } from "./types";

export function useFrameCaRects(
  frameCoordinate: FrameCoordinate,
  caCoordinate: CaCoordinate,
): DOMRect[] {
  return useMemo(() => {
    return caCoordinate.target.map((targetRect) => {
      let x = targetRect.x - scrollX;
      let y = targetRect.y - scrollY;

      for (const frame of [...frameCoordinate.ancestor].reverse()) {
        x += frame.rect.x;
        y += frame.rect.y;
        x -= frame.scrollX;
        y -= frame.scrollY;
      }

      return new DOMRect(x, y, targetRect.width, targetRect.height);
    });
  }, [frameCoordinate, caCoordinate]);
}
