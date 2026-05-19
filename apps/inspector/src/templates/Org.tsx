import { Icon } from "@iconify/react";
import { WebMediaProfile, WebsiteProfile } from "@originator-profile/model";
import {
  CertificateDetail,
  CertificateSummary,
  Description,
  ModalDialog,
  _,
  sortCertificates,
  useModalDialog,
} from "@originator-profile/ui";
import { Certificate, VerifiedOps } from "@originator-profile/verify";
import { useMemo, useState } from "react";
import { twMerge } from "tailwind-merge";
import BackHeader from "../components/BackHeader";
import ReliabilityGuide from "../components/ReliabilityGuide";
import WebMediaProfileSummary from "../components/WebMediaProfileSummary";

function ExternalLink(props: React.ComponentProps<"a">) {
  return (
    <a
      className={twMerge(
        "jumpu-card flex items-center gap-2.5 px-5 py-3 text-sm hover:bg-blue-50",
        props.className,
      )}
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      <span>{props.children}</span>
      <Icon
        className="text-gray-500"
        icon="fa6-solid:arrow-up-right-from-square"
      />
    </a>
  );
}

function ReliabilityInfo(props: {
  wmp: WebMediaProfile;
  certificates: Certificate[];
  ops?: VerifiedOps;
}) {
  const dialog = useModalDialog();
  const sortedCertificates = useMemo(
    () => sortCertificates(props.certificates),
    [props.certificates],
  );
  const [certificate, setCertificate] = useState<Certificate | null>(
    sortedCertificates[0] ?? null,
  );
  return (
    <div className="space-y-4">
      {props.wmp.credentialSubject.description && (
        <Description
          description={props.wmp.credentialSubject.description}
          onlyBody={true}
          className="text-black [&_:where(p,ul,ol,li)]:my-2 [&_:first-child]:mt-0"
        />
      )}
      {props.wmp.credentialSubject.informationTransmissionPolicy && (
        <section>
          <h2 className="whitespace-pre-line text-xs text-gray-600 mb-3">
            {_("Org_InformationTransmissionPolicy")}
          </h2>
          <ExternalLink
            href={props.wmp.credentialSubject.informationTransmissionPolicy.id}
          >
            {props.wmp.credentialSubject.informationTransmissionPolicy.name}
          </ExternalLink>
        </section>
      )}
      {props.wmp.credentialSubject.publishingPrinciple && (
        <section>
          <h2 className="whitespace-pre-line text-xs text-gray-600 mb-3">
            {_("Org_EditorialGuidelines")}
          </h2>
          <ExternalLink
            href={props.wmp.credentialSubject.publishingPrinciple.id}
          >
            {props.wmp.credentialSubject.publishingPrinciple.name}
          </ExternalLink>
        </section>
      )}
      {props.wmp.credentialSubject.privacyPolicy && (
        <section>
          <h2 className="whitespace-pre-line text-xs text-gray-600 mb-3">
            {_("Org_PrivacyPolicy")}
          </h2>
          <ExternalLink href={props.wmp.credentialSubject.privacyPolicy.id}>
            {props.wmp.credentialSubject.privacyPolicy.name}
          </ExternalLink>
        </section>
      )}
      <section>
        <h2 className="whitespace-pre-line text-xs text-gray-600 mb-3">
          {_("Org_CredentialInformation")}
        </h2>
        <ul className="space-y-2">
          {sortedCertificates.map((certificate, index) => (
            <li key={index}>
              <CertificateSummary
                className="w-full"
                certificate={certificate}
                onClick={() => {
                  setCertificate(certificate);
                  dialog.open();
                }}
                ops={props.ops}
              />
            </li>
          ))}
        </ul>
      </section>
      <ModalDialog
        dialogRef={dialog.ref}
        onClose={async () => {
          await dialog.close();
          setCertificate(null);
        }}
        className="group-aria-hidden:translate-y-full translate-y-0 bottom-0 w-full"
      >
        <CertificateDetail
          className="rounded-b-none"
          certificate={certificate ?? undefined}
          ops={props.ops}
        />
      </ModalDialog>
    </div>
  );
}

type Props = {
  backPath: {
    pathname: string;
    search: string;
  };
  ops?: VerifiedOps;
  certificates: Certificate[];
  contentType: string;
  wmp: WebMediaProfile;
  wsp?: WebsiteProfile;
};

function Org({ backPath, certificates, ops, contentType, wmp, wsp }: Props) {
  return (
    <article className="bg-gray-50 flex flex-col min-h-dvh">
      <BackHeader className="sticky top-0 z-10" to={backPath}>
        {wsp && <h1 className="text-sm">{wsp?.credentialSubject.name}</h1>}
      </BackHeader>
      <div className="bg-white px-4 border-b border-gray-200">
        <ReliabilityGuide className="pt-4 pb-2" contentType={contentType} />
        <div data-testid="ps-json-holder" className="flex justify-center pb-4">
          <WebMediaProfileSummary wmp={wmp} />
        </div>
      </div>
      <div className="p-4">
        <ReliabilityInfo certificates={certificates} wmp={wmp} ops={ops} />
      </div>
    </article>
  );
}

export default Org;
