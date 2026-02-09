import { WebMediaProfile } from "@originator-profile/model";
import { useMemo } from "react";
import { FramesVerifiedCas, SupportedVerifiedCa } from "../credentials";
import { listCas } from "../credentials/cas";
import { ElementCaMarker } from "./ElementCaMarker";
import { FrameCaMarker } from "./FrameCaMarker";
import type { CaFilterType } from "./window-events";

type CaMapFragmentProps = {
  ca: SupportedVerifiedCa;
  activeCa: SupportedVerifiedCa | null;
  onClickCa: (ca: SupportedVerifiedCa) => void;
  wmps: WebMediaProfile[];
  page: boolean;
  frameId: number;
  filtered: boolean;
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
        filtered={props.filtered}
      />
    );
  }
  return (
    <FrameCaMarker
      ca={props.ca}
      active={active}
      onClickCa={props.onClickCa}
      wmp={wmp}
      frameId={props.frameId}
      filtered={props.filtered}
    />
  );
}

type Props = {
  framesCas: FramesVerifiedCas;
  activeCa: SupportedVerifiedCa | null;
  onClickCa: (ca: SupportedVerifiedCa) => void;
  wmps: WebMediaProfile[];
  filterType: CaFilterType;
};

export function CasMap(props: Props) {
  // フィルター対象のCA IDを取得
  const filteredCaIds = useMemo(
    () =>
      new Set(
        props.framesCas.flatMap((frameCas) =>
          listCas(frameCas.cas, props.filterType).map(
            (ca) => ca.attestation.doc.credentialSubject.id,
          ),
        ),
      ),
    [props.framesCas, props.filterType],
  );

  return (
    <>
      {props.framesCas.flatMap((frameCas) =>
        frameCas.cas.map((ca) => (
          <CaMapFragment
            key={`${frameCas.frameId}-${ca.attestation.doc.credentialSubject.id}`}
            ca={ca}
            activeCa={props.activeCa}
            onClickCa={props.onClickCa}
            wmps={props.wmps}
            page={frameCas.parentFrameId === -1}
            frameId={frameCas.frameId}
            filtered={filteredCaIds.has(
              ca.attestation.doc.credentialSubject.id,
            )}
          />
        )),
      )}
    </>
  );
}
