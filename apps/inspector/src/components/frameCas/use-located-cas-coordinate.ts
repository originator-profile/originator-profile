import {
  FrameCasCoordinate,
  FramesCasCoordinate,
  frameCasWindowMessenger,
} from "@originator-profile/extension-common";
import { startTransition, useEffect, useState } from "react";
import { useMap } from "react-use";
import { useFrameCasLocationConsumer } from "./use-frame-cas-location-consumer";

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
  }, [update]);

  useFrameCasLocationConsumer({}, () => {
    setIsLocating(true);
  });

  return {
    framesCasCoordinate: Object.values(frameCasCoordinateMap),
    isLocating,
  };
}
