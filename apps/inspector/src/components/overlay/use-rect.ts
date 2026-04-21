import { startTransition, useCallback, useEffect, useState } from "react";
import { useEvent } from "react-use";
import useIntersection from "./use-intersection";

/** 要素の寸法と相対位置を返すフック関数 */
function useRect(element: HTMLElement) {
  const { isIntersecting } = useIntersection(element);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const handler = useCallback(() => {
    startTransition(() => {
      setRect((isIntersecting && element.getBoundingClientRect()) || null);
    });
  }, [isIntersecting, element]);
  useEvent("resize", handler, window.parent);
  useEvent("scroll", handler, window.parent);
  useEffect(handler, [handler]);
  return { rect };
}

export default useRect;
