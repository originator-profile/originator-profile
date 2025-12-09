import { Icon } from "@iconify/react";
import {
  CoreProfile,
  WebMediaProfile,
  WebsiteProfile,
} from "@originator-profile/model";
import { VerifiedVc } from "@originator-profile/securing-mechanism";
import {
  CertificateDetail,
  CertificateSummary,
  Description,
  ModalDialog,
  WebMediaProfileTable,
  _,
  useModalDialog,
} from "@originator-profile/ui";
import { Certificate } from "@originator-profile/verify";
import clsx from "clsx";
import { useState } from "react";
import BackHeader from "../components/BackHeader";
import ReliabilityGuide from "../components/ReliabilityGuide";
import WebMediaProfileSummary from "../components/WebMediaProfileSummary";

function ExternalLink(props: React.ComponentProps<"a">) {
  return (
    <a
      className={clsx(
        "jumpu-card flex items-center gap-2.5 px-3 py-5 text-sm hover:bg-blue-50",
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
  certificates: VerifiedVc<Certificate>[];
}) {
  const dialog = useModalDialog();
  const [certificate, setCertificate] =
    useState<VerifiedVc<Certificate> | null>(props.certificates[0] ?? null);
  return (
    <div className="space-y-4">
      {props.wmp.credentialSubject.informationTransmissionPolicy && (
        <section>
          <h2 className="whitespace-pre-line text-xs text-gray-600 mb-3">
            {_("Org_EditorialGuidelines")}
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
          {props.certificates.map((certificate, index) => (
            <li key={index}>
              <CertificateSummary
                className="w-full"
                certificate={certificate}
                onClick={() => {
                  setCertificate(certificate);
                  dialog.open();
                }}
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
        />
      </ModalDialog>
    </div>
  );
}

function OrgInfo(props: {
  verifiedCp: VerifiedVc<CoreProfile>;
  wmp: WebMediaProfile;
}) {
  return (
    <div className="space-y-4">
      {props.wmp.credentialSubject.description && (
        <Description
          description={props.wmp.credentialSubject.description ?? ""}
          onlyBody
        />
      )}
      <section>
        <h2 className="whitespace-pre-line text-xs text-gray-600 mb-3">
          {_("Org_OrganizationInformation")}
        </h2>
        <div className="jumpu-card p-4">
          <WebMediaProfileTable wmp={props.wmp} />
        </div>
      </section>
    </div>
  );
}

type Tabs = {
  id: string;
  name: string;
  panel: React.ReactNode;
}[];

function useTabs(tabs: Tabs) {
  const [activeTab, setActiveTab] = useState<
    (typeof tabs)[number]["id"] | null
  >(tabs[0]?.id ?? null);
  const handleClick = (value: typeof activeTab) => () => setActiveTab(value);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const index = tabs.findIndex(({ id }) => id === activeTab);
    let nextTab: (typeof tabs)[number] | undefined;
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        nextTab = tabs.at(index + 1) ?? tabs.at(0);
        break;
      case "ArrowLeft":
        event.preventDefault();
        nextTab = tabs.at(index - 1);
        break;
      case "Home":
        event.preventDefault();
        nextTab = tabs.at(0);
        break;
      case "End":
        event.preventDefault();
        nextTab = tabs.at(-1);
        break;
    }
    if (!nextTab) return;
    setActiveTab(nextTab.id);
  };
  const handleRef: React.RefCallback<HTMLButtonElement> = (node) => {
    if (node?.ariaSelected === "true") node.focus();
  };

  return {
    activeTab,
    handleClick,
    handleKeyDown,
    handleRef,
  };
}

type Props = {
  backPath: {
    pathname: string;
    search: string;
  };
  certificates: VerifiedVc<Certificate>[];
  contentType: string;
  verifiedCp: VerifiedVc<CoreProfile>;
  wmp: WebMediaProfile;
  wsp?: WebsiteProfile;
};

function Org({
  backPath,
  certificates,
  contentType,
  verifiedCp,
  wmp,
  wsp,
}: Props) {
  const tabs = [
    {
      id: "reliability",
      name: _("Org_ReliabilityInformation"),
      panel: <ReliabilityInfo certificates={certificates} wmp={wmp} />,
    },
    {
      id: "org",
      name: _("Org_OrganizationInformation"),
      panel: <OrgInfo verifiedCp={verifiedCp} wmp={wmp} />,
    },
  ] as const satisfies Tabs;
  const { activeTab, ...handlers } = useTabs(tabs);
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
        <div role="tablist" className="grid grid-cols-2 gap-0.5 py-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`${tab.id}-tab`}
              className={clsx(
                "text-sm rounded-sm jumpu-button",
                activeTab !== tab.id && "bg-white text-gray-600",
              )}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={handlers.handleClick(tab.id)}
              onKeyDown={handlers.handleKeyDown}
              type="button"
              ref={handlers.handleRef}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${tab.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${tab.id}-tab`}
          hidden={activeTab !== tab.id}
          className="p-4"
        >
          {tab.panel}
        </div>
      ))}
    </article>
  );
}

export default Org;
