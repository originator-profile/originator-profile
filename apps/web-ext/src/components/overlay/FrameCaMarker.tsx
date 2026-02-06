import { WebMediaProfile } from "@originator-profile/model";
import { twMerge } from "tailwind-merge";
import { SupportedVerifiedCa } from "../credentials";
import { CaCoordinate, FrameCoordinate } from "../frameCas/types";
import { useFrameCaRects } from "../frameCas/use-frame-ca-rects";
import { useLocatedCasCoordinate } from "../frameCas/use-located-cas-coordinate";
import { CaMarker } from "./CaMarker";

function Rects({
  frame,
  ca,
  children,
}: {
  frame: FrameCoordinate;
  ca: CaCoordinate;
  children: ({ rects }: { rects: DOMRect[] }) => React.ReactNode;
}) {
  const rects = useFrameCaRects(frame, ca);
  if (!rects) return null;
  return <>{children({ rects })}</>;
}

type Props = {
  ca: SupportedVerifiedCa;
  wmp?: WebMediaProfile;
  active: boolean;
  onClickCa: (ca: SupportedVerifiedCa) => void;
  frameId: number;
  filtered: boolean;
};

export function FrameCaMarker(props: Props) {
  const { framesCasCoordinate, isLocating } = useLocatedCasCoordinate();
  const frameCasCoordinate = framesCasCoordinate.find(
    (frameCasCoordinate) => frameCasCoordinate.frameId === props.frameId,
  );
  if (!frameCasCoordinate) return null;
  const { cas, ...frame } = frameCasCoordinate;

  const caCoordinate = cas.find(
    (c) => c.id === props.ca.attestation.doc.credentialSubject.id,
  );
  if (!caCoordinate) return null;

  const handleClick = () => props.onClickCa(props.ca);

  return (
    <Rects frame={frame} ca={caCoordinate}>
      {({ rects }) =>
        rects.map((rect, index) => (
          <CaMarker
            key={`${frame.frameId}-${caCoordinate.id}-${index}`}
            className={twMerge(
              "transition transition-discrete starting:opacity-0",
              isLocating ? "opacity-0 hidden" : "opacity-100",
            )}
            rect={rect}
            active={props.active}
            onClick={handleClick}
            wmp={props.wmp}
            filtered={props.filtered}
          />
        ))
      }
    </Rects>
  );
}
