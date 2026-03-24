import { Image, _ } from "@originator-profile/ui";
import placeholderLogoMainUrl from "@originator-profile/ui/src/assets/placeholder-logo-main.png";
import GlobalHeader from "../GlobalHeader";
import ReliabilityGuide from "../ReliabilityGuide";
import WebMediaProfileSummaryCard from "../WebMediaProfileSummaryCard";
import { SiteProfileProps } from "./types";

export function SiteProfile(props: SiteProfileProps) {
  return (
    <>
      {/* Credential での CaSelector 部分とスタッキングコンテキストで下に重なってしまうため z-11 に設定 */}
      <GlobalHeader className="sticky top-0 z-11">
        {props.wsp && (
          <h1 className="text-sm">{props.wsp?.credentialSubject.name}</h1>
        )}
      </GlobalHeader>
      <div data-testid="site-profile" className="bg-gray-50 p-4">
        <div className="flex flex-col items-center gap-4 pt-3">
          {props.wsp.credentialSubject.image && (
            <Image
              className="shrink-0 w-fit"
              src={props.wsp.credentialSubject.image.id}
              placeholderSrc={placeholderLogoMainUrl}
              alt=""
              width={240}
              height={44}
            />
          )}
          <h1
            className="w-fit text-base text-gray-700 mb-2"
            data-testid="site-profile-wsp-name"
          >
            {props.wsp.credentialSubject.name}
          </h1>
          <ReliabilityGuide
            className="mb-3"
            contentType="ContentType_Site"
            showLinkVerification={true}
          />
        </div>
        {props.orgPath && props.wmp ? (
          <div className="mb-3" data-testid="pp-json-holder">
            <WebMediaProfileSummaryCard to={props.orgPath} wmp={props.wmp} />
          </div>
        ) : (
          <div>
            <h1
              className="text-base text-center mb-6"
              data-testid="web-media-profile-missing"
            >
              {_("WebMediaProfile_Missing")}
            </h1>
            <p className="whitespace-pre-line text-xs text-gray-700 text-center leading-5">
              {_("WebMediaProfile_Missing_Reason")}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
