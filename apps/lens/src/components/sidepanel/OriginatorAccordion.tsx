import IconChevronDown from "@iconify-react/fa6-solid/chevron-down";
import { _, Image } from "@originator-profile/extension-common/ui";
import placeholderLogoMainUrl from "@originator-profile/extension-common/ui/assets/placeholder-logo-main.png";
import { useState } from "react";
import { twMerge } from "tailwind-merge";
import type { Organization } from "../../view";
import { ExternalLink } from "../detail/ExternalLink";
import { CountryFlag, countryName } from "./CountryFlag";

type Props = {
  organization: Organization;
  /** 同時に 1 つだけ開くアコーディオンの組の名前 */
  name: string;
  open: boolean;
  /** 開閉したとき。開いていれば true */
  onToggle: (open: boolean) => void;
  /** 「詳細はこちら」を押したとき。未指定ならボタンを出さない */
  onShowDetail?: () => Promise<void>;
  className?: string;
};

function Summary({
  organization: { id, media, country },
}: {
  organization: Organization;
}) {
  return (
    <summary className="flex min-h-12 cursor-pointer list-none items-center py-3 pr-2 pl-4 transition-colors group-open:border-b group-open:border-gray-300 hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black">
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

/**
 * 「詳細はこちら」のボタン
 *
 * 開き終えるまでは押しても何もしない。開けなければ、ボタンの下にそのことを示す
 */
function DetailButton({ onShowDetail }: { onShowDetail: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const showDetail = async () => {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      await onShowDetail();
    } catch (error) {
      console.warn("Failed to open the organization detail:", error);
      setFailed(true);
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="flex flex-col">
      {/* NOTE: disabled 属性はフォーカスを外してしまうため aria-disabled にする */}
      <button
        type="button"
        className="w-full cursor-pointer rounded-md border border-gray-500 px-4 py-2.5 text-left text-xs leading-normal text-black transition-colors hover:bg-gray-50"
        aria-disabled={pending}
        onClick={() => void showDetail()}
      >
        {_("Sidepanel_ShowDetail")}
        <span className="sr-only">{_("Link_OpensInNewWindow")}</span>
      </button>
      {/* NOTE: 読み上げさせるため、空のうちから置いて中身だけを変える */}
      <output className="text-xs leading-normal text-black not-empty:mt-2">
        {failed && _("Sidepanel_ShowDetailFailed")}
      </output>
    </div>
  );
}

function Body({
  organization: { media, country },
  onShowDetail,
}: {
  organization: Organization;
  onShowDetail?: () => Promise<void>;
}) {
  const url = media?.credentialSubject.url;
  return (
    <div className="flex flex-col gap-3 px-4 pt-3.5 pb-4">
      {country && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-black">
          <CountryFlag country={country} decorative />
          {countryName(country)}
        </p>
      )}
      {url && (
        <ExternalLink href={url}>{_("Sidepanel_OfficialSite")}</ExternalLink>
      )}
      {onShowDetail && <DetailButton onShowDetail={onShowDetail} />}
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
        "group accordion jumpu-card w-full rounded-[10px] transition-colors open:border-gray-500",
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
