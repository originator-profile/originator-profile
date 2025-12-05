import { WebMediaProfile } from "@originator-profile/model";
import { SupportedVerifiedCa } from "../credentials";
import { CaCoordinate, FrameCasCoordinate } from "../frameCas/types";
import { useAbsoluteRects } from "../frameCas/use-absolute-rects";
import { useLocatedCasCoordinate } from "../frameCas/use-located-cas-coordinate";
import { CaMarker } from "./CaMarker";

type Props = {
  ca: SupportedVerifiedCa;
  wmp?: WebMediaProfile;
  active: boolean;
  onClickCa: (ca: SupportedVerifiedCa) => void;
};

function isMarkerVisible(
  frameCasCoordinate: FrameCasCoordinate | null,
  caCoordinate: CaCoordinate | undefined,
  rect: DOMRect | undefined,
): rect is DOMRect {
  if (!frameCasCoordinate || !caCoordinate || !rect) {
    return false;
  }
  return frameCasCoordinate.ancestor.every((a) => a.visible);
}

function useMarkerData(ca: SupportedVerifiedCa) {
  const { frameCasCoordinate } = useLocatedCasCoordinate();

  const caCoordinate = frameCasCoordinate?.cas.find(
    (c) => c.id === ca.attestation.doc.credentialSubject.id,
  );

  const rects = useAbsoluteRects(
    frameCasCoordinate?.ancestor ?? [],
    {
      scrollX: frameCasCoordinate?.scrollX ?? 0,
      scrollY: frameCasCoordinate?.scrollY ?? 0,
    },
    caCoordinate?.target ?? [],
  );

  return { frameCasCoordinate, caCoordinate, rect: rects[0] };
}

export function AbsoluteCaMarker(props: Props) {
  const { frameCasCoordinate, caCoordinate, rect } = useMarkerData(props.ca);

  if (!isMarkerVisible(frameCasCoordinate, caCoordinate, rect)) {
    return null;
  }

  const handleClick = () => props.onClickCa(props.ca);

  return (
    <CaMarker
      rect={rect}
      active={props.active}
      onClick={handleClick}
      wmp={props.wmp}
    />
  );
}
