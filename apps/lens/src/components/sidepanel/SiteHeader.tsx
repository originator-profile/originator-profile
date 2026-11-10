import { _ } from "@originator-profile/extension-common/ui";
import type { ReactNode } from "react";
import type { SiteView } from "../../view";

type Props = {
  site: SiteView;
  /** 運営者の表示。運営者を提示するときだけ用いる */
  operator?: ReactNode;
};

/** Web サイトとその運営者の見出し */
export function SiteHeader({ site, operator }: Props) {
  if (site.state === "absent") {
    return (
      <p
        className="text-sm leading-[1.35] text-black"
        data-testid="site-header"
      >
        {_("Sidepanel_NoSiteOperator")}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-2" data-testid="site-header">
      <h1 className="text-sm leading-[1.35] font-bold text-black">
        {site.name}
      </h1>
      {site.state === "present" && (
        <>
          <p className="text-xs font-medium text-black">
            {_("Sidepanel_SiteOperator")}
          </p>
          {operator}
        </>
      )}
    </section>
  );
}
