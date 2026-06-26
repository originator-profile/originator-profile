import {
  Certificate,
  getAnnotationPolicy,
  VerifiedOps,
} from "@originator-profile/verify";
import { twMerge } from "tailwind-merge";
import placeholderLogoMainUrl from "../../assets/placeholder-logo-main.png";
import { _ } from "../../utils/get-message";
import Image from "../Image";
import { useProfileAnnotatorWmp } from "./use-profile-annotator-wmp";

type Props = {
  className?: string;
  certificate: Certificate;
  onClick: (certificate: Certificate) => void;
  ops?: VerifiedOps;
};

export function CertificateSummary({
  className,
  certificate,
  ops,
  onClick,
}: Props) {
  const handleClick = () => onClick(certificate);
  const paWmp = useProfileAnnotatorWmp(ops ?? [], certificate.issuer);
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
          certificate.credentialSubject.type === "CertificateProperties"
            ? certificate.credentialSubject.image?.id
            : undefined
        }
        placeholderSrc={placeholderLogoMainUrl}
        alt=""
        width={60}
        height={40}
      />
      <span className="flex flex-col gap-2 items-start">
        <span className="text-sm">{getAnnotationPolicy(certificate).name}</span>
        <span className="text-xs text-gray-600">
          {_(
            "CertificateSummary_IssuedBy",
            paWmp?.credentialSubject.name ?? certificate.issuer,
          )}
        </span>
      </span>
    </button>
  );
}
