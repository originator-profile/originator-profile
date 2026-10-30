import { selectByLocale } from "@originator-profile/core";
import { SupportedVerifiedCaWithSource } from "@originator-profile/extension-common";
import {
  getAnnotationPolicy,
  VerifiedOps,
  VerifiedSp,
} from "@originator-profile/verify";
import { useParams } from "react-router";
import { useCredentials } from "../components/credentials";
import Loading from "../components/Loading";
import { useSiteProfile } from "../components/siteProfile";
import Template from "../templates/Popup";

function extractSiteProfile(siteProfile?: VerifiedSp) {
  if (!siteProfile) return null;
  const selectedWsp = selectByLocale(siteProfile.sites.map((s) => s.doc));
  if (!selectedWsp) return null;

  const siteProfileOp = siteProfile.originators.find((originator) =>
    originator.media?.some(
      (m) => m.doc.credentialSubject.id === selectedWsp.issuer,
    ),
  );
  const selectedWmp =
    siteProfileOp?.media &&
    selectByLocale(siteProfileOp.media.map((m) => m.doc));
  const selectedAnnotations =
    siteProfileOp?.annotations &&
    selectByLocale(
      siteProfileOp.annotations.map((a) => a.doc),
      {
        group: (a) =>
          JSON.stringify([
            a.issuer,
            a.credentialSubject.id,
            getAnnotationPolicy(a).id,
          ]),
      },
    );
  return { selectedWsp, selectedWmp, selectedAnnotations };
}

function extractContentAttestation(
  ops: VerifiedOps,
  ca?: SupportedVerifiedCaWithSource,
) {
  if (!ca) return { selectedWmp: undefined, selectedAnnotations: undefined };

  const contentAttestationOp = ops.find((op) =>
    op.media?.some(
      (m) => m.doc.credentialSubject.id === ca.attestation.doc.issuer,
    ),
  );

  const selectedWmp =
    contentAttestationOp?.media &&
    selectByLocale(contentAttestationOp.media.map((m) => m.doc));

  const selectedAnnotations =
    contentAttestationOp?.annotations &&
    selectByLocale(
      contentAttestationOp.annotations.map((a) => a.doc),
      {
        group: (a) =>
          JSON.stringify([
            a.issuer,
            a.credentialSubject.id,
            getAnnotationPolicy(a).id,
          ]),
      },
    );

  return { selectedWmp, selectedAnnotations };
}

function renderPopupContent(
  ca: SupportedVerifiedCaWithSource | undefined,
  siteProfile: VerifiedSp | undefined,
  ops: VerifiedOps,
) {
  const selectedSp = extractSiteProfile(siteProfile);
  const selectedCa = extractContentAttestation(ops, ca);

  const isSameIssuer = Boolean(
    ca &&
    selectedSp &&
    selectedSp.selectedWsp.issuer === ca.attestation.doc.issuer,
  );

  const shouldShowSp = selectedSp && (!ca || !isSameIssuer);
  const shouldShowCa = Boolean(ca);

  return (
    <Template
      {...(shouldShowSp
        ? {
            siteProfileWmp: selectedSp.selectedWmp,
            siteProfileCertificates: selectedSp.selectedAnnotations,
            wsp: selectedSp.selectedWsp,
          }
        : {})}
      {...(shouldShowCa
        ? {
            wmp: selectedCa.selectedWmp,
            certificates: selectedCa.selectedAnnotations,
            ca,
          }
        : {})}
    />
  );
}

export default function Popup() {
  const { issuer = "", subject = "" } = useParams<{
    issuer?: string;
    subject?: string;
  }>();
  const { siteProfile } = useSiteProfile();
  const { ops, cas, isLoading, error } = useCredentials();
  if (isLoading) return <Loading />;
  if (error) {
    console.error("Error loading credentials:", error);
    return null;
  }

  const ca = cas.find(
    (ca) =>
      ca.main === true &&
      ca.attestation.doc.issuer === issuer &&
      ca.attestation.doc.credentialSubject.id === subject,
  );

  if (!ca && !siteProfile) return null;

  return renderPopupContent(ca, siteProfile, ops);
}
