import { Image } from "@originator-profile/extension-common/ui";
import placeholderLogoMainUrl from "@originator-profile/extension-common/ui/assets/placeholder-logo-main.png";
import tooltipTailUrl from "../../assets/tooltip-tail.svg";
import type { HighlightLabel } from "../../overlay/protocol";
import { CountryFlag } from "../sidepanel/CountryFlag";

/** 強調した範囲の上に添える、発信者の組織のタグ */
export function HighlightTag({ label }: { label: HighlightLabel }) {
  return (
    <div className="relative flex items-center gap-2 rounded-lg bg-white/90 px-4 py-2 drop-shadow-[0_0_2px_rgba(0,0,0,0.1)] drop-shadow-[0_1px_0.5px_rgba(0,0,0,0.3)]">
      <Image
        className="size-4 shrink-0"
        src={label.logo}
        placeholderSrc={placeholderLogoMainUrl}
        alt=""
        width={16}
        height={16}
      />
      <p className="text-xs font-medium whitespace-nowrap text-black">
        {label.name}
      </p>
      {label.country && <CountryFlag country={label.country} />}
      <img
        className="absolute -bottom-[5.5px] left-1/2 -translate-x-1/2 -rotate-45"
        src={tooltipTailUrl}
        alt=""
        width={11}
        height={11}
      />
    </div>
  );
}
