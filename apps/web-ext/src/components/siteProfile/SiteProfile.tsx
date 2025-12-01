import { Icon } from "@iconify/react";
import {
  Image,
  ModalDialog,
  TechInfo,
  _,
  useModalDialog,
} from "@originator-profile/ui";
import placeholderLogoMainUrl from "@originator-profile/ui/src/assets/placeholder-logo-main.png";
import ReliabilityGuide from "../ReliabilityGuide";
import WebMediaProfileSummaryCard from "../WebMediaProfileSummaryCard";
import { SiteProfileProps } from "./types";

export function SiteProfile(props: SiteProfileProps) {
  const dialog = useModalDialog();
  return (
    <div data-testid="site-profile" className="bg-gray-50 p-4">
      <div className="flex justify-center">
        <ModalDialog
          dialogRef={dialog.ref}
          className="group-aria-hidden:translate-y-full translate-y-0 bottom-0 w-full"
          onClose={dialog.close}
        >
          <TechInfo
            className="rounded-b-none max-h-[80svh] overflow-auto"
            value={props.siteProfile}
          />
        </ModalDialog>
        <p className="whitespace-pre-line jumpu-badge bg-gray-600 text-xs text-white font-normal border border-gray-300 mb-3">
          {_("ContentType_Site")}
        </p>
        <button
          className="jumpu-icon-button text-xs rounded-full bg-gray-100 border-gray-200 w-6 h-6 ml-1 group"
          aria-describedby="tooltip-1"
          onClick={dialog.open}
        >
          <Icon className="inline" icon={"fa6-solid:wrench"} />
          <span
            id="tooltip-1"
            role="tooltip"
            className="[transform:translate(-50%,150%)_scale(0)]! group-hover:[transform:translate(-50%,150%)_scale(1)]!"
          >
            {_("SiteProfile_TechnicalInformation")}
          </span>
        </button>
      </div>
      <div className="flex flex-col items-center gap-4">
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
          {props.siteProfile.credential.doc.credentialSubject.name}
        </h1>
        <ReliabilityGuide className="mb-3" contentType="ContentType_Site" />
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
  );
}
