import { AbsoluteCaMarker } from "./AbsoluteCaMarker";
import { ElementCaMarker } from "./ElementCaMarker";
import { WebMediaProfile } from "@originator-profile/model";
import { SupportedVerifiedCas, SupportedVerifiedCa } from "../credentials";

type CaMapFragmentProps = {
  ca: SupportedVerifiedCa;
  activeCa: SupportedVerifiedCa | null;
  onClickCa: (ca: SupportedVerifiedCa) => void;
  wmps: WebMediaProfile[];
};

function CaMapFragment(props: CaMapFragmentProps) {
  const wmp = props.wmps.find(
    (wmp) => wmp.credentialSubject.id === props.ca.attestation.doc.issuer,
  );
  const active =
    props.ca.attestation.doc.credentialSubject.id ===
    props.activeCa?.attestation.doc.credentialSubject.id;
  return (
    <>
      <ElementCaMarker
        ca={props.ca}
        active={active}
        onClickCa={props.onClickCa}
        wmp={wmp}
      />
      <AbsoluteCaMarker
        ca={props.ca}
        active={active}
        onClickCa={props.onClickCa}
        wmp={wmp}
      />
    </>
  );
}

type Props = {
  cas: SupportedVerifiedCas;
  activeCa: SupportedVerifiedCa | null;
  onClickCa: (ca: SupportedVerifiedCa) => void;
  wmps: WebMediaProfile[];
};

export function CasMap(props: Props) {
  return (
    <>
      {props.cas.map((ca) => (
        <CaMapFragment
          key={ca.attestation.doc.credentialSubject.id}
          ca={ca}
          activeCa={props.activeCa}
          onClickCa={props.onClickCa}
          wmps={props.wmps}
        />
      ))}
    </>
  );
}
