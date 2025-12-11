import { Icon } from "@iconify/react";
import { WebMediaProfile } from "@originator-profile/model";
import { Image, _ } from "@originator-profile/ui";
import logomarkUrl from "@originator-profile/ui/src/assets/logomark.svg";
import placeholderLogoMainUrl from "@originator-profile/ui/src/assets/placeholder-logo-main.png";

type Props = {
  wmp: WebMediaProfile;
};

function WebMediaProfileSummary({ wmp }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Image
        className="shrink-0 border box-content rounded-sm border-gray-200"
        src={wmp.credentialSubject.logo?.id}
        placeholderSrc={placeholderLogoMainUrl}
        alt=""
        width={52}
        height={52}
      />
      <div className="flex flex-col space-y-1">
        <div className="flex flex-row space-x-1">
          <p className="text-base font-bold">{wmp.credentialSubject.name}</p>
          <img src={logomarkUrl} alt="" width={18} height={16} />
        </div>
        <div className="flex flex-row flex-wrap gap-1">
          {wmp.credentialSubject.informationTransmissionPolicy && (
            <p className="jumpu-tag rounded-full px-2 text-xs text-gray-600">
              <Icon className="inline mr-1" icon="gg:check-o" />
              {_("WebMediaProfileSummary_InformationTransmissionPolicy")}
            </p>
          )}
          {wmp.credentialSubject.publishingPrinciple && (
            <p className="jumpu-tag rounded-full px-2 text-xs text-gray-600">
              <Icon className="inline mr-1" icon="gg:check-o" />
              {_("WebMediaProfileSummary_EditorialGuidelines")}
            </p>
          )}
          {wmp.credentialSubject.privacyPolicy && (
            <p className="jumpu-tag rounded-full px-2 text-xs text-gray-600">
              <Icon className="inline mr-1" icon="gg:check-o" />
              {_("WebMediaProfileSummary_PrivacyPolicy")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default WebMediaProfileSummary;
