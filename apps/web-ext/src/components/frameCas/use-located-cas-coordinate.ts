import { startTransition, useEffect, useState } from "react";
import { useFrameCasLocationConsumer } from "./use-frame-cas-location-consumer";
import { useMap } from "react-use";
import { frameCasWindowMessenger } from "./window-events";
import { FrameCasCoordinate, FramesCasCoordinate } from "./types";

export function useLocatedCasCoordinate(): {
  framesCasCoordinate: FramesCasCoordinate;
  isLocating: boolean;
} {
  const [frameCasCoordinateMap, update] =
    useMap<Record<number, FrameCasCoordinate>>();
  const [isLocating, setIsLocating] = useState(true);

  useEffect(() => {
    const handler = ({ data }: MessageEvent<FrameCasCoordinate>) => {
      startTransition(() => {
        update.set(data.frameId, data);
        setIsLocating(false);
      });
    };
    const cleanup = frameCasWindowMessenger.onMessage("located", handler);
    return () => {
      cleanup();
    };
  }, []);

  useFrameCasLocationConsumer({}, () => {
    setIsLocating(true);
  });

  return {
    framesCasCoordinate: Object.values(frameCasCoordinateMap),
    isLocating,
  };
}
