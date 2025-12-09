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
      <div className="flex flex-col">
        <div className="flex flex-row">
          <p className="text-base font-bold">{wmp.credentialSubject.name}</p>
          <img
            className="ml-1"
            src={logomarkUrl}
            alt=""
            width={18}
            height={16}
          />
        </div>
        <div className="flex flex-row">
          {wmp.credentialSubject.informationTransmissionPolicy && (
            <div className="bg-gray-100 rounded-full px-1 py-1 mx-1 my-1">
              <p className="inline-flex items-center align-middle text-xs text-gray-600 px-1">
                <Icon className="inline mr-1" icon="gg:check-o" />
                {_("WebMediaProfileSummary_InformationTransmissionPolicy")}
              </p>
            </div>
          )}
          {wmp.credentialSubject.publishingPrinciple && (
            <div className="bg-gray-100 rounded-full px-1 py-1 mx-1 my-1">
              <p className="inline-flex items-center align-middle text-xs text-gray-600 px-1">
                <Icon className="inline mr-1" icon="gg:check-o" />
                {_("WebMediaProfileSummary_EditorialGuidelines")}
              </p>
            </div>
          )}
          {wmp.credentialSubject.privacyPolicy && (
            <div className="bg-gray-100 rounded-full px-1 py-1 mx-1 my-1">
              <p className="inline-flex items-center align-middle text-xs text-gray-600 px-1">
                <Icon className="inline mr-1" icon="gg:check-o" />
                {_("WebMediaProfileSummary_PrivacyPolicy")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WebMediaProfileSummary;
