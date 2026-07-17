import { Icon } from "@iconify/react";
import {
  Certificate,
  getAnnotationPolicy,
  VerifiedOps,
} from "@originator-profile/verify";
import { twMerge } from "tailwind-merge";
import placeholderLogoMainUrl from "../../assets/placeholder-logo-main.png";
import { _ } from "../../utils/get-message";
import Image from "../Image";
import Spinner from "../Spinner";
import { useProfileAnnotatorWmp } from "./use-profile-annotator-wmp";

type Props = {
  className?: string;
  certificate?: Certificate;
  ops?: VerifiedOps;
};

function CertificateDescription(props: { description?: string }) {
  if (!props.description) return null;
  return <p className="text-sm text-gray-600">{props.description}</p>;
}

function CertificateRef(props: { ref?: string }) {
  if (!props.ref) return null;
  return (
    <a
      className="card border px-5 py-3 flex items-center justify-between gap-2.5 rounded-2xl"
      target="_blank"
      rel="noopener noreferrer"
      /* oxlint-disable-next-line react/react-compiler */
      href={props.ref}
    >
      <span className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">
          {_("CertificateDetail_Details")}
        </span>
        {/* oxlint-disable-next-line react/react-compiler */}
        <span className="text-sm">{props.ref}</span>
      </span>
      <Icon className="text-sm text-gray-500" icon="fa6-solid:arrow-right" />
    </a>
  );
}

function CertificateDetailContent({
  certificate,
  ops,
}: Props & Required<Pick<Props, "certificate">>) {
  const paWmp = useProfileAnnotatorWmp(ops ?? [], certificate.issuer);
  const policy = getAnnotationPolicy(certificate);
  return (
    <>
      <header className="flex items-center gap-3 mb-4">
        <Image
          src={
            certificate.credentialSubject.type === "CertificateProperties"
              ? certificate.credentialSubject.image?.id
              : undefined
          }
          placeholderSrc={placeholderLogoMainUrl}
          alt=""
          width={60}
          height={40}
        />
        <div className="space-y-0.5 ">
          {/* oxlint-disable-next-line react/react-compiler */}
          <h2 className="text-sm text-black">{policy.name}</h2>
          <p className="text-xs text-gray-600">
            {_(
              "CertificateDetail_IssuedBy",
              paWmp?.credentialSubject.name ?? certificate.issuer,
            )}
          </p>
        </div>
      </header>
      <CertificateDescription
        description={certificate.credentialSubject.description}
      />
      {/* oxlint-disable-next-line react/react-compiler */}
      <CertificateDescription description={policy.description} />
      {/* oxlint-disable-next-line react/react-compiler */}
      <CertificateRef ref={policy.ref} />
    </>
  );
}

export function CertificateDetail({ className, certificate, ops }: Props) {
  return (
    <div className={twMerge("jumpu-card p-5 rounded-2xl space-y-3", className)}>
      {certificate ? (
        <CertificateDetailContent certificate={certificate} ops={ops} />
      ) : (
        <div className="flex flex-col justify-center items-center gap-4 pt-6 pb-4">
          <Spinner />
          <p>{_("CertificateDetail_Loading")}</p>
        </div>
      )}
    </div>
  );
}
