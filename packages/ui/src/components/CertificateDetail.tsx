import { Icon } from "@iconify/react";
import { VerifiedVc } from "@originator-profile/securing-mechanism";
import { Certificate } from "@originator-profile/verify";
import { twMerge } from "tailwind-merge";
import placeholderLogoMainUrl from "../assets/placeholder-logo-main.png";
import { _ } from "../utils/get-message";
import Image from "./Image";
import Spinner from "./Spinner";

type Props = {
  className?: string;
  certificate?: VerifiedVc<Certificate>;
};

function CertificateDetailContent({ certificate }: Props) {
  if (!certificate)
    return (
      <div className="flex flex-col justify-center items-center gap-4 pt-6 pb-4">
        <Spinner />
        <p>{_("CertificateDetail_Loading")}</p>
      </div>
    );
  return (
    <>
      <header className="flex items-center gap-3 mb-4">
        <Image
          src={
            certificate.doc.credentialSubject.type === "CertificateProperties"
              ? certificate.doc.credentialSubject.image?.id
              : undefined
          }
          placeholderSrc={placeholderLogoMainUrl}
          alt=""
          width={60}
          height={40}
        />
        <div className="space-y-0.5 ">
          <h2 className="text-sm text-black">
            {certificate.doc.credentialSubject.certificationSystem.name}
          </h2>
          <p className="text-xs text-gray-600">
            {_("CertificateDetail_IssuedBy", certificate.doc.issuer)}
          </p>
        </div>
      </header>
      {"description" in certificate.doc.credentialSubject && (
        <p className="text-sm text-gray-600">
          {certificate.doc.credentialSubject.description}
        </p>
      )}
      {"description" in
        certificate.doc.credentialSubject.certificationSystem && (
        <p className="text-sm text-gray-600">
          {certificate.doc.credentialSubject.certificationSystem.description}
        </p>
      )}
      {certificate.doc.credentialSubject.certificationSystem.ref && (
        <a
          className="card border px-5 py-3 flex items-center justify-between gap-2.5 rounded-2xl"
          target="_blank"
          rel="noopener noreferrer"
          href={certificate.doc.credentialSubject.certificationSystem.ref}
        >
          <span className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">
              {_("CertificateDetail_Details")}
            </span>
            <span className="text-sm">
              {certificate.doc.credentialSubject.certificationSystem.ref}
            </span>
          </span>
          <Icon
            className="text-sm text-gray-500"
            icon="fa6-solid:arrow-right"
          />
        </a>
      )}
    </>
  );
}

function CertificateDetail({ className, certificate }: Props) {
  return (
    <div className={twMerge("jumpu-card p-5 rounded-2xl space-y-3", className)}>
      <CertificateDetailContent certificate={certificate} />
    </div>
  );
}

export default CertificateDetail;
