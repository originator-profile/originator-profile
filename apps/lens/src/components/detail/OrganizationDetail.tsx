import IconChevronLeft from "@iconify-react/fa6-solid/chevron-left";
import { _, Image } from "@originator-profile/extension-common/ui";
import placeholderLogoMainUrl from "@originator-profile/extension-common/ui/assets/placeholder-logo-main.png";
import { useEffect, useRef } from "react";
import type { OrganizationDetail as Detail } from "../../view";
import { OrganizationFacts } from "../sidepanel/OrganizationFacts";
import { AnnotationGroupView } from "./AnnotationGroupView";
import { ExternalLink } from "./ExternalLink";

// TODO: 「このツールについて」のリンク先の URL が確定したら差し替える
const aboutUrl = "https://originator-profile.org/";

/** 組織が公表している方針のリンク */
function policyLinksOf({ organization }: Detail) {
  const subject = organization.media?.credentialSubject;
  if (!subject) return [];
  return [
    subject.informationTransmissionPolicy,
    subject.publishingPrinciple,
    subject.privacyPolicy,
    { id: subject.url, name: _("Sidepanel_OfficialSite") },
  ].filter((link) => link !== undefined);
}

type Props = {
  detail: Detail;
  /** 戻るボタンを押したとき */
  onBack: () => void;
};

/**
 * 組織の詳細
 *
 * サイドパネルの中で、コンテンツの一覧に重ねて表示する。表示したら戻るボタンに
 * フォーカスを移す。
 */
export function OrganizationDetail({ detail, onBack }: Props) {
  const { organization, groups } = detail;
  const subject = organization.media?.credentialSubject;
  const name = subject?.name ?? organization.id;
  const links = policyLinksOf(detail);
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus(), []);

  return (
    <div
      className="fixed inset-0 z-10 flex flex-col overflow-y-auto overscroll-contain bg-gray-100"
      data-testid="detail"
    >
      <header className="sticky top-0 flex items-center gap-4 border-b border-gray-300 bg-white p-4">
        <button
          ref={back}
          type="button"
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-gray-300 text-black transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-black"
          aria-label={_("Detail_Back")}
          onClick={onBack}
        >
          <IconChevronLeft className="size-4" aria-hidden />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-3">
            <Image
              className="size-5 shrink-0"
              src={subject?.logo?.id}
              placeholderSrc={placeholderLogoMainUrl}
              alt=""
              width={20}
              height={20}
            />
            <h1 className="min-w-0 text-lg leading-normal font-bold text-black">
              {name}
            </h1>
          </div>
          <OrganizationFacts organization={organization} />
        </div>
      </header>
      <div className="flex flex-col gap-8 px-4 py-6">
        {groups.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-base font-medium text-black">
              {_("Detail_ThirdPartyVerification")}
            </h2>
            <div className="flex flex-col gap-8 rounded-xl bg-white p-4">
              {groups.map((group) => (
                <AnnotationGroupView key={group.issuer.id} group={group} />
              ))}
            </div>
          </section>
        )}
        {links.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-base font-medium text-black">
              {_("Detail_PublishedPolicies")}
            </h2>
            <ul className="flex flex-col gap-1.5 rounded-2xl bg-white p-4">
              {links.map(({ id, name }, index) => (
                <li key={index} className="flex">
                  <ExternalLink href={id}>{name}</ExternalLink>
                </li>
              ))}
            </ul>
          </section>
        )}
        <footer className="flex justify-center">
          <a
            className="text-xs text-gray-600 underline transition-[text-decoration-thickness] hover:decoration-2"
            href={aboutUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            {_("Detail_AboutThisTool")}
            <span className="sr-only">{_("Link_OpensInNewTab")}</span>
          </a>
        </footer>
      </div>
    </div>
  );
}
