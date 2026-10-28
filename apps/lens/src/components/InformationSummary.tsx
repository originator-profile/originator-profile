import IconGgCheckO from "@iconify-react/gg/check-o";
import { Image, _ } from "@originator-profile/extension-common/ui";
import placeholderLogoMainUrl from "@originator-profile/extension-common/ui/assets/placeholder-logo-main.png";
import { WebMediaProfile } from "@originator-profile/model";
import { Certificate, getAnnotationPolicy } from "@originator-profile/verify";

type Props = {
  wmp: WebMediaProfile;
  certificates: Certificate[];
};

export default function InformationSummary({ wmp, certificates }: Props) {
  const hasExistencePa = certificates.find(
    (a) =>
      a.credentialSubject.type === "JP-OrganizationExistenceCertificate" ||
      getAnnotationPolicy(a).id ===
        "urn:uuid:def09cbd-6e8e-4c73-856d-5e00dffde643",
  );
  return (
    <div className="flex gap-2">
      <Image
        className="shrink-0 border box-content rounded-sm border-gray-200"
        src={wmp.credentialSubject.logo?.id}
        placeholderSrc={placeholderLogoMainUrl}
        alt=""
        width={52}
        height={52}
      />
      <div className="flex flex-col space-y-1">
        <div className="flex flex-row">
          <p className="text-base font-bold">{wmp.credentialSubject.name}</p>
        </div>
        <div className="flex flex-row flex-wrap gap-1">
          {hasExistencePa && (
            <p className="text-xs">
              <IconGgCheckO className="inline mr-1" height="1em" />
              {_("Popup_ProfileAnnotation_Type")}
            </p>
          )}
        </div>
        <div className="text-sm">
          {_("Popup_Description", [
            wmp.credentialSubject.name,
            hasExistencePa ? _("Popup_ProfileAnnotation_Type") : "",
          ])}
        </div>
      </div>
    </div>
  );
}
