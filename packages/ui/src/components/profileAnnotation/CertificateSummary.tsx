import { VerifiedVc } from "@originator-profile/securing-mechanism";
import { Certificate, VerifiedOps } from "@originator-profile/verify";
import { twMerge } from "tailwind-merge";
import { _ } from "../../utils/get-message";
import Image from "../Image";
import placeholderLogoMainUrl from "../../assets/placeholder-logo-main.png";
import { useProfileAnnotatorWmp } from "./use-profile-annotator-wmp";

type Props = {
  className?: string;
  certificate: VerifiedVc<Certificate>;
  onClick: (certificate: VerifiedVc<Certificate>) => void;
  ops?: VerifiedOps;
};

export function CertificateSummary({
  className,
  certificate,
  ops,
  onClick,
}: Props) {
  const handleClick = () => onClick(certificate);
  const paWmp = useProfileAnnotatorWmp(ops ?? [], certificate.doc.issuer);
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
            paWmp?.credentialSubject.name ?? certificate.doc.issuer,
          )}
        </span>
      </span>
    </button>
  );
}
