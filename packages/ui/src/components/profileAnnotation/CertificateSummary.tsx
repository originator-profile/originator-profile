import { VerifiedVc } from "@originator-profile/securing-mechanism";
import { Certificate } from "@originator-profile/verify";
import { twMerge } from "tailwind-merge";
import { _ } from "../../utils/get-message";
import Image from "../Image";
import placeholderLogoMainUrl from "../../assets/placeholder-logo-main.png";

type Props = {
  className?: string;
  certificate: VerifiedVc<Certificate>;
  onClick: (certificate: VerifiedVc<Certificate>) => void;
};

export function CertificateSummary({ className, certificate, onClick }: Props) {
  const handleClick = () => onClick(certificate);
  return (
    <button
      className={twMerge(
        "jumpu-card flex items-center gap-4 hover:bg-blue-50 px-4 py-3 rounded-lg",
        className,
      )}
      onClick={handleClick}
    >
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
      <span className="flex flex-col gap-2 items-start">
        <span className="text-sm">
          {certificate.doc.credentialSubject.certificationSystem.name}
        </span>
        <span className="text-xs text-gray-600">
          {_(
            "CertificateSummary_IssuedBy",
            certificate.doc.credentialSubject.type === "CertificateProperties"
              ? (certificate.doc.credentialSubject.certifier ??
                  certificate.doc.issuer)
              : certificate.doc.issuer,
          )}
        </span>
      </span>
    </button>
  );
}
