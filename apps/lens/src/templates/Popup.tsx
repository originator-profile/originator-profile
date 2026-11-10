import IconFa6SolidChevronRight from "@iconify-react/fa6-solid/chevron-right";
import IconGgCheckO from "@iconify-react/gg/check-o";
import {
  _,
  isArticleLike,
  SupportedVerifiedCa,
} from "@originator-profile/extension-common";
import { Image } from "@originator-profile/extension-common/ui";
import placeholderLogoMainUrl from "@originator-profile/extension-common/ui/assets/placeholder-logo-main.png";
import { WebMediaProfile, WebsiteProfile } from "@originator-profile/model";
import { Certificate } from "@originator-profile/verify";
import InformationSummary from "../components/InformationSummary";

const CA_TYPE_KEYS: Record<string, string> = {
  Article: "ContentType_Article",
  Advertorial: "ContentType_Advertorial",
  OnlineAd: "ContentType_Advertisement",
};

export function getContentType(caType: string) {
  const translationKey = CA_TYPE_KEYS[caType];
  return translationKey ? _(translationKey) : undefined;
}

type PopupProps = {
  siteProfileWmp?: WebMediaProfile;
  siteProfileCertificates?: Certificate[];
  wsp?: WebsiteProfile;
  wmp?: WebMediaProfile;
  certificates?: Certificate[];
  ca?: SupportedVerifiedCa;
};

export default function Popup(props: PopupProps) {
  const caType = getContentType(
    props.ca?.attestation.doc.credentialSubject.type ?? "",
  );

  const renderHeader = () => (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="flex items-center justify-center bg-primary-100 w-full rounded-2xl px-10 py-2 text-base font-bold text-primary-700 mb-2">
        <IconGgCheckO className="inline mr-1" height="1em" />
        {caType
          ? _("Popup_ContentAttestation_Header", caType)
          : _("Popup_Label_WebsiteProfile")}
      </div>
      <div className="text-lg font-bold">
        {props.ca
          ? props.wmp?.credentialSubject.name
          : props.siteProfileWmp?.credentialSubject.name}
      </div>
      <div className="text-base mb-4 font-bold">
        {caType
          ? _("Popup_ContentAttestation_Title", caType)
          : _("Popup_SiteProfile_Title")}
      </div>
    </div>
  );

  const renderCaSection = () => {
    if (!props.ca) return null;
    const subjectDoc = props.ca.attestation.doc.credentialSubject;
    const titleText = isArticleLike(subjectDoc)
      ? subjectDoc.headline
      : subjectDoc.name;

    return (
      <>
        <div className="flex items-center gap-2 font-bold text-sm mb-2">
          {titleText}
          <Image
            className="shrink-0 bg-white rounded-md"
            src={subjectDoc.image?.id}
            placeholderSrc={placeholderLogoMainUrl}
            alt=""
            width={70}
            height={50}
          />
        </div>
        <div className="flex">
          <div className="mb-3 w-full">
            <div className="flex items-center w-full mb-4">
              <span className="mr-2 whitespace-nowrap text-sm font-bold">
                {_("Popup_Label_ContentAttestation", caType)}
              </span>
              <div className="flex-grow border-t"></div>
            </div>
            {props.wmp && props.certificates && (
              <InformationSummary
                wmp={props.wmp}
                certificates={props.certificates}
              />
            )}
          </div>
        </div>
      </>
    );
  };
  const renderWspSection = () => {
    if (!props.wsp) return null;
    return (
      <div className="flex">
        <div className="mb-3 w-full">
          <div className="flex items-center w-full mb-4">
            <span className="mr-2 whitespace-nowrap text-sm font-bold">
              {_("Popup_Label_WebsiteProfile")}
            </span>
            <div className="flex-grow border-t"></div>
          </div>
          {props.siteProfileWmp && props.siteProfileCertificates && (
            <InformationSummary
              wmp={props.siteProfileWmp}
              certificates={props.siteProfileCertificates}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-5">
      {renderHeader()}
      <div className="flex-col rounded-2xl border mb-4 p-4">
        {renderCaSection()}
        {renderWspSection()}
      </div>
      <div className="flex items-center justify-center rounded-full border border-black font-bold text-base p-1">
        {caType
          ? _("Popup_ContentAttestation_Detail", caType)
          : _("Popup_SiteProfile_Detail")}
        <IconFa6SolidChevronRight
          className="text-base text-gray-700 ml-4"
          height="1em"
        />
      </div>
    </div>
  );
}
