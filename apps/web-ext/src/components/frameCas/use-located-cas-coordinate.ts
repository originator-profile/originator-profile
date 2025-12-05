import { startTransition, useEffect, useState } from "react";
import { useFrameCasLocationConsumer } from "./use-frame-cas-location-consumer";
import { frameCasWindowMessenger } from "./window-events";
import { FrameCasCoordinate } from "./types";

export function useLocatedCasCoordinate(): {
  frameCasCoordinate: FrameCasCoordinate | null;
} {
  const [frameCasCoordinate, setFrameCasCoordinate] =
    useState<FrameCasCoordinate | null>(null);

  useEffect(() => {
    const handler = ({ data }: MessageEvent<FrameCasCoordinate>) => {
      startTransition(() => {
        setFrameCasCoordinate(data);
      });
    };
    frameCasWindowMessenger.onMessage("located", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, []);

  useFrameCasLocationConsumer();

  return { frameCasCoordinate };
}
