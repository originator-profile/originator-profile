import { WebMediaProfile } from "@originator-profile/model";
import { useEffect } from "react";
import { SupportedVerifiedCa } from "../credentials";
import { CaMarker } from "./CaMarker";
import useElements from "./use-elements";
import useRect from "./use-rect";

function Rect({
  element,
  children,
  scroll,
  active,
}: {
  element: HTMLElement;
  active: boolean;
  scroll: boolean;
  children: ({ rect }: { rect: DOMRect }) => React.ReactNode;
}) {
  useEffect(() => {
    if (!active || !scroll) return;
    element.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [active, scroll, element]);
  const { rect } = useRect(element);
  if (!rect) return null;
  return <>{children({ rect })}</>;
}

type Props = {
  ca: SupportedVerifiedCa;
  wmp?: WebMediaProfile;
  active: boolean;
  onClickCa: (ca: SupportedVerifiedCa) => void;
  filtered: boolean;
};

export function ElementCaMarker(props: Props) {
  const {
    elements: [element],
  } = useElements(props.ca.attestation.doc.target);
  if (!element) return null;
  const handleClick = () => props.onClickCa(props.ca);
  return (
    <Rect element={element} active={props.active} scroll>
      {({ rect }) => (
        <CaMarker
          rect={rect}
          active={props.active}
          onClick={handleClick}
          wmp={props.wmp}
          filtered={props.filtered}
        />
      )}
    </Rect>
  );
}
