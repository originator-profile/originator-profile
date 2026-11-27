import { _ } from "@originator-profile/extension-common/ui";
import { twMerge } from "tailwind-merge";
import { uiLocale } from "../../utils/ui-locale";
import type { Organization } from "../../view";
import { ExternalLink } from "../detail/ExternalLink";
import { CountryFlag, countryName } from "./CountryFlag";

/**
 * 法人番号公表サイトの、その法人のページの URL
 * @param corporateNumber 法人番号
 */
export function corporateRegistryUrl(corporateNumber: string): string {
  const path = uiLocale().startsWith("ja") ? "" : "en/";
  const url = new URL(
    `https://www.houjin-bangou.nta.go.jp/${path}henkorireki-johoto.html`,
  );
  url.searchParams.set("selHouzinNo", corporateNumber);
  return url.href;
}

/** 組織について示す事柄があるか */
export const hasFacts = ({ country, media, corporateNumber }: Organization) =>
  !!(country || media?.credentialSubject.url || corporateNumber);

/** 組織の国と、公式サイト・法人登記へのリンク */
export function OrganizationFacts({
  organization: { country, media, corporateNumber },
}: {
  organization: Organization;
}) {
  const url = media?.credentialSubject.url;
  const hasLinks = !!(url || corporateNumber);
  return (
    // NOTE: 国とリンクの区切り線は、リンクが次の行に送られたら出さない。
    // 区切り線をリンクの左の外側に描き、行頭に来たら容器の外で切り落とす。
    // 容器を -ml-1 pl-1 で広げ、リンクのフォーカスリングは切らない
    <div className="-ml-1 flex flex-wrap items-center gap-x-5 gap-y-1.5 overflow-x-clip pl-1">
      {country && (
        <p className="flex items-center gap-1.5 text-xs leading-none font-medium text-black">
          <CountryFlag country={country} decorative />
          {countryName(country)}
        </p>
      )}
      {hasLinks && (
        <div
          className={twMerge(
            "flex flex-wrap items-center gap-x-3 gap-y-1.5",
            country &&
              "relative before:absolute before:top-1/2 before:-left-2.5 before:h-3.25 before:w-px before:-translate-y-1/2 before:bg-gray-300",
          )}
        >
          {url && (
            <ExternalLink href={url}>
              {_("Sidepanel_OfficialSite")}
            </ExternalLink>
          )}
          {corporateNumber && (
            <ExternalLink href={corporateRegistryUrl(corporateNumber)}>
              {_("Organization_CorporateRegistry")}
            </ExternalLink>
          )}
        </div>
      )}
    </div>
  );
}
