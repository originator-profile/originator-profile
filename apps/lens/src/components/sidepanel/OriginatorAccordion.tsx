import IconArrowRight from "@iconify-react/fa6-solid/arrow-right";
import IconChevronDown from "@iconify-react/fa6-solid/chevron-down";
import { _, Image } from "@originator-profile/extension-common/ui";
import placeholderLogoMainUrl from "@originator-profile/extension-common/ui/assets/placeholder-logo-main.png";
import type { MouseEvent } from "react";
import { twMerge } from "tailwind-merge";
import type { Organization } from "../../view";
import { CountryFlag } from "./CountryFlag";
import { hasFacts, OrganizationFacts } from "./OrganizationFacts";

type Props = {
  organization: Organization;
  /** 同時に 1 つだけ開くアコーディオンの組の名前 */
  name: string;
  open: boolean;
  /** 開閉したとき。開いていれば true */
  onToggle: (open: boolean) => void;
  /** 「第三者による確認」を押したとき。押したボタンを受け取る */
  onShowDetail: (button: HTMLButtonElement) => void;
  className?: string;
};

function Summary({
  organization: { id, media, country },
}: {
  organization: Organization;
}) {
  return (
    <summary className="flex min-h-12 cursor-pointer list-none items-center py-3 pr-2 pl-4 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Image
          className="size-6 shrink-0"
          src={media?.credentialSubject.logo?.id}
          placeholderSrc={placeholderLogoMainUrl}
          alt=""
          width={24}
          height={24}
        />
        <span className="text-sm leading-[1.3] font-medium text-black">
          {media?.credentialSubject.name ?? id}
        </span>
        {country && (
          <CountryFlag
            className="group-open:hidden"
            country={country}
            decorative
          />
        )}
      </span>
      <span className="flex size-6 shrink-0 items-center justify-center">
        <IconChevronDown
          className="size-3.5 text-black group-open:rotate-180 motion-safe:transition-[rotate]"
          aria-hidden
        />
      </span>
    </summary>
  );
}

function Body({
  organization,
  onShowDetail,
}: {
  organization: Organization;
  onShowDetail: (button: HTMLButtonElement) => void;
}) {
  const { membership } = organization;
  return (
    <div className="flex flex-col">
      {(hasFacts(organization) || membership) && (
        <div className="flex flex-col gap-1.5 px-4 pt-3 pb-3.5">
          <OrganizationFacts organization={organization} />
          {membership && (
            <p className="text-xs leading-normal font-medium text-black">
              {membership}
            </p>
          )}
        </div>
      )}
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between border-t border-gray-300 px-5 py-3 text-left text-xs leading-normal font-bold text-black transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black"
        onClick={(event: MouseEvent<HTMLButtonElement>) =>
          onShowDetail(event.currentTarget)
        }
      >
        {_("Detail_ThirdPartyVerification")}
        <IconArrowRight className="size-3.5 shrink-0" aria-hidden />
      </button>
    </div>
  );
}

/**
 * 発信者の組織のアコーディオン
 *
 * NOTE: 同じ name の組では、1 つを開くとブラウザーがほかを閉じる
 */
export function OriginatorAccordion({
  organization,
  name,
  open,
  onToggle,
  onShowDetail,
  className,
}: Props) {
  return (
    <details
      className={twMerge(
        "group accordion w-full overflow-hidden rounded-[10px] border border-gray-300 bg-white",
        className,
      )}
      name={name}
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
    >
      <Summary organization={organization} />
      <Body organization={organization} onShowDetail={onShowDetail} />
    </details>
  );
}
