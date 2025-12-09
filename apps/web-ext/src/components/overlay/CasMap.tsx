import { AbsoluteCaMarker } from "./AbsoluteCaMarker";
import { ElementCaMarker } from "./ElementCaMarker";
import { WebMediaProfile } from "@originator-profile/model";
import { FramesVerifiedCas, SupportedVerifiedCa } from "../credentials";

type CaMapFragmentProps = {
  ca: SupportedVerifiedCa;
  activeCa: SupportedVerifiedCa | null;
  onClickCa: (ca: SupportedVerifiedCa) => void;
  wmps: WebMediaProfile[];
  page: boolean;
};

function CaMapFragment(props: CaMapFragmentProps) {
  const wmp = props.wmps.find(
    (wmp) => wmp.credentialSubject.id === props.ca.attestation.doc.issuer,
  );
  const active =
    props.ca.attestation.doc.credentialSubject.id ===
    props.activeCa?.attestation.doc.credentialSubject.id;
  if (props.page) {
    return (
      <ElementCaMarker
        ca={props.ca}
        active={active}
        onClickCa={props.onClickCa}
        wmp={wmp}
      />
    );
  }
  return (
    <AbsoluteCaMarker
      ca={props.ca}
      active={active}
      onClickCa={props.onClickCa}
      wmp={wmp}
    />
  );
}

type Props = {
  framesCas: FramesVerifiedCas;
  activeCa: SupportedVerifiedCa | null;
  onClickCa: (ca: SupportedVerifiedCa) => void;
  wmps: WebMediaProfile[];
};

export function CasMap(props: Props) {
  return (
    <>
      {props.framesCas.flatMap((frameCas) =>
        frameCas.cas.map((ca) => (
          <CaMapFragment
            key={ca.attestation.doc.credentialSubject.id}
            ca={ca}
            activeCa={props.activeCa}
            onClickCa={props.onClickCa}
            wmps={props.wmps}
            page={frameCas.parentFrameId === -1}
          />
        )),
      )}
    </>
  );
}
