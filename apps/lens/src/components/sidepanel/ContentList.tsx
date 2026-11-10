import { _ } from "@originator-profile/extension-common/ui";
import { useId, useState } from "react";
import {
  sectionsOf,
  type ContentCategory,
  type Organization,
  type TabView,
} from "../../view";
import { ContentCard, NoMainContentCard } from "./ContentCard";
import { OriginatorAccordion } from "./OriginatorAccordion";
import { SiteHeader } from "./SiteHeader";

const categoryLabels: Record<ContentCategory, string> = {
  article: "ContentType_Article",
  advertorial: "ContentType_Advertorial",
  media: "ContentType_Media",
  unknown: "ContentType_Unknown",
  advertisement: "ContentType_Advertisement",
};

type Props = Extract<TabView, { state: "ready" }>;

/**
 * Web サイトの運営者と、ページのコンテンツの一覧
 *
 * NOTE: アコーディオンは同時に 1 つしか開かない
 */
export function ContentList({ site, contents, issuers }: Props) {
  // NOTE: 開いているアコーディオン。Web サイトの運営者は "site"、コンテンツは key
  const [openKey, setOpenKey] = useState<string>();
  const name = useId();
  const toggle = (key: string) => (open: boolean) =>
    setOpenKey((current) => {
      if (open) return key;
      return current === key ? undefined : current;
    });
  const accordion = (key: string, organization: Organization) => (
    <OriginatorAccordion
      organization={organization}
      name={name}
      open={openKey === key}
      onToggle={toggle(key)}
    />
  );

  const sections = sectionsOf(contents);
  const hasMain = contents.some(({ main }) => main);

  return (
    <div className="flex flex-col gap-3 bg-gray-100 px-4 py-6">
      <SiteHeader
        site={site}
        operator={site.state === "present" && accordion("site", site.operator)}
      />
      <div className="flex flex-col gap-6 rounded-2xl bg-white p-4">
        {!hasMain && <NoMainContentCard />}
        {sections.map(({ category, contents }) => (
          <section key={category} className="flex flex-col gap-2">
            <h2 className="text-xs font-medium text-black">
              {_(categoryLabels[category])}
            </h2>
            <div className="flex flex-col gap-3">
              {contents.map((content) => {
                const issuer = issuers.get(content.issuer);
                return (
                  <ContentCard
                    key={content.key}
                    content={content}
                    originator={issuer && accordion(content.key, issuer)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
