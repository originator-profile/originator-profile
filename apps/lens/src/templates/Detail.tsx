import { _, Image } from "@originator-profile/extension-common/ui";
import placeholderLogoMainUrl from "@originator-profile/extension-common/ui/assets/placeholder-logo-main.png";
import { AnnotationGroupView } from "../components/detail/AnnotationGroupView";
import { ExternalLink } from "../components/detail/ExternalLink";
import { CountryFlag, countryName } from "../components/sidepanel/CountryFlag";
import type { Organization, OrganizationDetail } from "../view";

/** 組織が公表している方針のリンク */
function policyLinksOf({ organization }: OrganizationDetail) {
  const subject = organization.media?.credentialSubject;
  if (!subject) return [];
  return [
    subject.informationTransmissionPolicy,
    subject.publishingPrinciple,
    subject.privacyPolicy,
    { id: subject.url, name: _("Sidepanel_OfficialSite") },
  ].filter((link) => link !== undefined);
}

function Header({ organization }: { organization: Organization }) {
  const subject = organization.media?.credentialSubject;
  const name = subject?.name ?? organization.id;
  return (
    <header className="flex flex-col gap-3 border-b border-gray-300 py-4 pr-2 pl-6">
      <title>{`${name} - ${_("extensionName")}`}</title>
      <div className="flex items-center gap-3">
        <Image
          className="shrink-0"
          src={subject?.logo?.id}
          placeholderSrc={placeholderLogoMainUrl}
          alt=""
          width={40}
          height={40}
        />
        <h1 className="text-lg leading-normal font-bold text-black">{name}</h1>
      </div>
      {organization.country && (
        <p className="flex items-center gap-1.5 text-xs leading-none font-medium text-black">
          <CountryFlag country={organization.country} decorative />
          {countryName(organization.country)}
        </p>
      )}
    </header>
  );
}

function Detail({ detail }: { detail: OrganizationDetail }) {
  const { organization, groups } = detail;
  const links = policyLinksOf(detail);

  return (
    <div className="flex min-h-screen flex-col bg-white" data-testid="detail">
      <Header organization={organization} />
      <main className="flex flex-col gap-8 p-6">
        {groups.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-xs font-medium text-black">
              {_("Detail_ThirdPartyVerification")}
            </h2>
            <div className="flex flex-col gap-8">
              {groups.map((group) => (
                <AnnotationGroupView key={group.issuer.id} group={group} />
              ))}
            </div>
          </section>
        )}
        {links.length > 0 && (
          <ul className="flex flex-col gap-1.5 border-t border-gray-200 pt-8 pb-8">
            {links.map(({ id, name }) => (
              <li key={id} className="flex">
                <ExternalLink href={id}>{name}</ExternalLink>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

export default Detail;
