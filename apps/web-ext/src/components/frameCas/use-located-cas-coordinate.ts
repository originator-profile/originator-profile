import { startTransition, useEffect, useState } from "react";
import { useFrameCasLocationConsumer } from "./use-frame-cas-location-consumer";
import { frameCasWindowMessenger } from "./window-events";
import { FrameCasCoordinate, FramesCasCoordinate } from "./types";

export function useLocatedCasCoordinate(): {
  framesCasCoordinate: FramesCasCoordinate;
  isLocating: boolean;
} {
  const [frameCasCoordinateMap, setFrameCasCoordinateMap] = useState<
    Map<number, FrameCasCoordinate>
  >(new Map());
  const [isLocating, setIsLocating] = useState(true);

  useEffect(() => {
    const handler = ({ data }: MessageEvent<FrameCasCoordinate>) => {
      startTransition(() => {
        setFrameCasCoordinateMap((prev) =>
          new Map(prev).set(data.frameId, data),
        );
        setIsLocating(false);
      });
    };
    frameCasWindowMessenger.onMessage("located", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, []);

  useFrameCasLocationConsumer({}, (isLocating) => {
    setIsLocating(isLocating);
  });

  return {
    framesCasCoordinate: Array.from(frameCasCoordinateMap.values()),
    isLocating,
  };
}
